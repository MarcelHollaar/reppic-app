import {
  AUDIO_RETENTION_MS,
  CONVERSATION_STATUS,
  RECORDING_CLEANUP_BATCH_SIZE,
  TWIN_AI_STATUS,
} from "@/configs/constants";
import { prisma } from "../utils/prisma";
import {
  deleteConversationDirectory,
  deleteFile,
  listAudioChunks,
} from "../utils/fileStorage";

type EligibleConversation = {
  id: string;
  user_id: string;
  file_path: string | null;
};

export type RecordingCleanupResult = {
  processed: number;
  deleted: number;
  skipped: number;
  errors: number;
  dryRun: boolean;
  conversationIds: string[];
};

function normalizeFtpPath(filePath: string): string {
  let ftpPath = filePath;

  if (ftpPath.startsWith("http")) {
    const ftpRoot =
      process.env.NEXT_PUBLIC_FTP_PUBLIC_URL ||
      process.env.FTP_PUBLIC_URL ||
      "";
    if (ftpPath.startsWith(ftpRoot)) {
      ftpPath = ftpPath.replace(ftpRoot, "");
      if (ftpPath.startsWith("/")) ftpPath = ftpPath.slice(1);
    }
  }

  return ftpPath.replace(/^\/+/, "");
}

async function deleteLegacyFile(filePath: string | null): Promise<void> {
  if (!filePath) return;

  await deleteFile(normalizeFtpPath(filePath));
}

export async function findEligibleConversations(
  limit = RECORDING_CLEANUP_BATCH_SIZE,
): Promise<EligibleConversation[]> {
  const now = new Date();
  const retentionCutoff = new Date(Date.now() - AUDIO_RETENTION_MS);

  return prisma.userConversation.findMany({
    where: {
      transcript_status: "completed",
      conversation_status: CONVERSATION_STATUS.COMPLETED_TWIN_AI_PROCESS,
      twinai_run_status: TWIN_AI_STATUS.COMPLETED,
      audio_deleted_at: null,
      conversation_summaries_x: { some: {} },
      OR: [
        { audio_retention_until: { lte: now } },
        {
          audio_retention_until: null,
          evaluated_at: { lte: retentionCutoff, not: null },
        },
        {
          audio_retention_until: null,
          evaluated_at: null,
          updated_at: { lte: retentionCutoff },
        },
      ],
    },
    take: limit,
    select: {
      id: true,
      user_id: true,
      file_path: true,
    },
    orderBy: { updated_at: "asc" },
  });
}

async function cleanupConversationAudio(
  conversation: EligibleConversation,
): Promise<"deleted" | "error"> {
  const { FTP_HOST, FTP_USER, FTP_PASSWORD } = process.env;

  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    console.warn(
      `[RecordingCleanup] FTP not configured, skipping ${conversation.id}`,
    );
    return "error";
  }

  try {
    const chunksBefore = await listAudioChunks(
      conversation.user_id,
      conversation.id,
    ).catch(() => [] as string[]);

    if (chunksBefore.length > 0) {
      await deleteConversationDirectory(conversation.user_id, conversation.id);

      const chunksAfter = await listAudioChunks(
        conversation.user_id,
        conversation.id,
      ).catch(() => [] as string[]);

      if (chunksAfter.length > 0) {
        console.error(
          `[RecordingCleanup] FTP files remain for ${conversation.id}`,
        );

        return "error";
      }
    } else {
      await deleteConversationDirectory(
        conversation.user_id,
        conversation.id,
      ).catch(() => {});
    }

    if (conversation.file_path) {
      await deleteLegacyFile(conversation.file_path);
    }

    await prisma.userConversation.update({
      where: { id: conversation.id },
      data: {
        audio_deleted_at: new Date(),
        file_path: null,
      },
    });

    console.log(`[RecordingCleanup] Deleted audio for ${conversation.id}`);

    return "deleted";
  } catch (error) {
    console.error(`[RecordingCleanup] Failed for ${conversation.id}:`, error);

    return "error";
  }
}

export async function runRecordingCleanup({
  dryRun = false,
  limit = RECORDING_CLEANUP_BATCH_SIZE,
}: {
  dryRun?: boolean;
  limit?: number;
} = {}): Promise<RecordingCleanupResult> {
  const conversations = await findEligibleConversations(limit);

  const result: RecordingCleanupResult = {
    processed: conversations.length,
    deleted: 0,
    skipped: 0,
    errors: 0,
    dryRun,
    conversationIds: conversations.map((c) => c.id),
  };

  if (dryRun) {
    result.deleted = conversations.length;

    return result;
  }

  for (const conversation of conversations) {
    const outcome = await cleanupConversationAudio(conversation);

    if (outcome === "deleted") {
      result.deleted++;
    } else {
      result.errors++;
    }
  }

  return result;
}
