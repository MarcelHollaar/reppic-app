import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../utils/prisma";
import { validateTranscriptAnalysisPrompt } from "@/lib/transcript-analysis/promptSchema";

const CACHE_TTL_MS = 60_000;

type CachedPrompt = {
  content: string;
  versionId: string | null;
  version: number | null;
  loadedAt: number;
};

let promptCache: CachedPrompt | null = null;

function readPromptFromFilesystem(): string {
  const candidates = [
    join(process.cwd(), "src/lib/transcript-analysis/prompt.md"),
    join(process.cwd(), ".next/server/src/lib/transcript-analysis/prompt.md"),
  ];

  for (const templatePath of candidates) {
    try {
      return readFileSync(templatePath, "utf-8");
    } catch {
      // try next path
    }
  }

  throw new Error(`prompt.md not found (tried: ${candidates.join(", ")})`);
}

function invalidatePromptCache(): void {
  promptCache = null;
}

async function getNextVersionNumber(): Promise<number> {
  const latest = await prisma.transcriptAnalysisPromptVersion.findFirst({
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (latest?.version ?? 0) + 1;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Keeps the DB in sync with prompt.md on every deployment, without fighting the
 * admin prompt editor.
 *
 * Rule: import prompt.md only when its exact content has NEVER been stored as a
 * version before.
 * - Empty table → seed version 1 from the file.
 * - Fresh deploy with a changed prompt.md → content is new → import + activate.
 * - prompt.md unchanged since last deploy → content already exists → skip, so a
 *   version activated manually via the admin UI is preserved (not reverted).
 *
 * This makes deployment plug & play (ship prompt.md, it applies automatically)
 * while keeping live admin edits intact.
 *
 * Concurrency-safe on two levels:
 * - An in-process guard collapses concurrent callers onto a single sync run.
 * - A unique-constraint (P2002) on `version` is treated as "another instance
 *   synced first" — relevant for horizontally scaled / multi-replica deploys.
 */
async function performSync(): Promise<void> {
  const fileContent = readPromptFromFilesystem();

  // Has this exact prompt.md already been imported as a version? If so, the file
  // hasn't changed since the last deploy — leave the active version as-is.
  const alreadyImported =
    await prisma.transcriptAnalysisPromptVersion.findFirst({
      where: { content: fileContent },
      select: { id: true },
    });

  if (alreadyImported) {
    return; // File content is known — nothing to import.
  }

  const validation = validateTranscriptAnalysisPrompt(fileContent);

  if (!validation.valid) {
    const anyVersionExists =
      await prisma.transcriptAnalysisPromptVersion.findFirst({
        select: { id: true },
      });

    if (anyVersionExists) {
      // Keep the existing DB version rather than crashing; log for visibility.
      console.warn(
        `[TranscriptAnalysis] prompt.md failed validation — keeping current DB version. Errors: ${validation.errors.map((e) => e.message).join("; ")}`,
      );
      return;
    }
    throw new Error(
      `Default prompt.md failed validation: ${validation.errors.map((e) => e.message).join("; ")}`,
    );
  }

  const nextVersion = await getNextVersionNumber();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.transcriptAnalysisPromptVersion.updateMany({
        where: { is_active: true },
        data: { is_active: false },
      });
      await tx.transcriptAnalysisPromptVersion.create({
        data: {
          version: nextVersion,
          content: fileContent,
          is_active: true,
          note:
            nextVersion === 1
              ? "Seeded from prompt.md"
              : "Auto-updated from prompt.md on deployment",
          created_by: null,
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      // Another process created this version number concurrently. Its content
      // is identical (same prompt.md), so simply drop our stale cache and let
      // the next read pick up the winner.
      invalidatePromptCache();
      console.warn(
        `[TranscriptAnalysis] Prompt sync race detected (version ${nextVersion}); another instance won. Using its version.`,
      );
      return;
    }
    throw error;
  }

  invalidatePromptCache();
  console.log(
    `[TranscriptAnalysis] Prompt auto-synced to version ${nextVersion} from prompt.md.`,
  );
}

let inFlightSync: Promise<void> | null = null;

async function syncPromptFromFilesystem(): Promise<void> {
  // Collapse concurrent callers (cold cache after restart) onto one run.
  if (inFlightSync) return inFlightSync;

  inFlightSync = performSync().finally(() => {
    inFlightSync = null;
  });

  return inFlightSync;
}

export type TranscriptAnalysisPromptVersionDto = {
  id: string;
  version: number;
  content: string;
  isActive: boolean;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

function toDto(
  row: {
    id: string;
    version: number;
    content: string;
    is_active: boolean;
    note: string | null;
    created_by: string | null;
    created_at: Date;
  },
  includeContent = true,
): TranscriptAnalysisPromptVersionDto {
  return {
    id: row.id,
    version: row.version,
    content: includeContent ? row.content : "",
    isActive: row.is_active,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
}

async function getActiveRow() {
  await syncPromptFromFilesystem();

  return prisma.transcriptAnalysisPromptVersion.findFirst({
    where: { is_active: true },
    orderBy: { version: "desc" },
  });
}

export const transcriptAnalysisPromptService = {
  invalidatePromptCache,

  validateContent(content: string) {
    return validateTranscriptAnalysisPrompt(content);
  },

  async getActiveContent(): Promise<string> {
    const now = Date.now();

    if (promptCache && now - promptCache.loadedAt < CACHE_TTL_MS) {
      return promptCache.content;
    }

    const active = await getActiveRow();

    if (active) {
      promptCache = {
        content: active.content,
        versionId: active.id,
        version: active.version,
        loadedAt: now,
      };
      return active.content;
    }

    const fallback = readPromptFromFilesystem();
    promptCache = {
      content: fallback,
      versionId: null,
      version: null,
      loadedAt: now,
    };
    return fallback;
  },

  async getActiveVersion(): Promise<TranscriptAnalysisPromptVersionDto | null> {
    const active = await getActiveRow();
    return active ? toDto(active) : null;
  },

  async listVersions(): Promise<TranscriptAnalysisPromptVersionDto[]> {
    await syncPromptFromFilesystem();

    const rows = await prisma.transcriptAnalysisPromptVersion.findMany({
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        content: true,
        is_active: true,
        note: true,
        created_by: true,
        created_at: true,
      },
    });

    return rows.map((row) => toDto(row, false));
  },

  async getVersionById(id: string): Promise<TranscriptAnalysisPromptVersionDto | null> {
    const row = await prisma.transcriptAnalysisPromptVersion.findUnique({
      where: { id },
    });

    return row ? toDto(row) : null;
  },

  async createVersion(params: {
    content: string;
    note?: string;
    createdBy?: string;
    activate?: boolean;
  }): Promise<TranscriptAnalysisPromptVersionDto> {
    const validation = validateTranscriptAnalysisPrompt(params.content);

    if (!validation.valid) {
      const message = validation.errors.map((issue) => issue.message).join(" ");
      throw new Error(message);
    }

    const version = await getNextVersionNumber();
    const shouldActivate = params.activate ?? true;

    const created = await prisma.$transaction(async (tx) => {
      if (shouldActivate) {
        await tx.transcriptAnalysisPromptVersion.updateMany({
          where: { is_active: true },
          data: { is_active: false },
        });
      }

      return tx.transcriptAnalysisPromptVersion.create({
        data: {
          version,
          content: params.content,
          is_active: shouldActivate,
          note: params.note?.trim() || null,
          created_by: params.createdBy ?? null,
        },
      });
    });

    invalidatePromptCache();
    return toDto(created);
  },

  async activateVersion(id: string): Promise<TranscriptAnalysisPromptVersionDto> {
    const target = await prisma.transcriptAnalysisPromptVersion.findUnique({
      where: { id },
    });

    if (!target) {
      throw new Error("Prompt version not found");
    }

    const validation = validateTranscriptAnalysisPrompt(target.content);

    if (!validation.valid) {
      const message = validation.errors.map((issue) => issue.message).join(" ");
      throw new Error(message);
    }

    const activated = await prisma.$transaction(async (tx) => {
      await tx.transcriptAnalysisPromptVersion.updateMany({
        where: { is_active: true },
        data: { is_active: false },
      });

      return tx.transcriptAnalysisPromptVersion.update({
        where: { id },
        data: { is_active: true },
      });
    });

    invalidatePromptCache();
    return toDto(activated);
  },
};
