import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../utils/prisma";
import { validatePrepAnalysisPrompt } from "@/lib/prep-analysis/promptSchema";

// Versioning-service voor de gespreksvoorbereidings-prompt. Zelfde patroon
// als transcriptAnalysisPromptService: cache 60s, filesystem-seed uit
// prompt.md (alleen bij onbekende content), admin-versies blijven leidend.

const CACHE_TTL_MS = 60_000;

type CachedPrompt = {
  content: string;
  loadedAt: number;
};

let promptCache: CachedPrompt | null = null;

function readPromptFromFilesystem(): string {
  const candidates = [
    join(process.cwd(), "src/lib/prep-analysis/prompt.md"),
    join(process.cwd(), ".next/server/src/lib/prep-analysis/prompt.md"),
  ];
  for (const templatePath of candidates) {
    try {
      return readFileSync(templatePath, "utf-8");
    } catch {
      // try next path
    }
  }
  throw new Error(
    `prep-analysis prompt.md not found (tried: ${candidates.join(", ")})`
  );
}

function invalidatePromptCache(): void {
  promptCache = null;
}

async function getNextVersionNumber(): Promise<number> {
  const latest = await prisma.prepAnalysisPromptVersion.findFirst({
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

async function performSync(): Promise<void> {
  const fileContent = readPromptFromFilesystem();

  const alreadyImported = await prisma.prepAnalysisPromptVersion.findFirst({
    where: { content: fileContent },
    select: { id: true },
  });
  if (alreadyImported) return;

  const validation = validatePrepAnalysisPrompt(fileContent);
  if (!validation.valid) {
    const anyVersionExists = await prisma.prepAnalysisPromptVersion.findFirst({
      select: { id: true },
    });
    if (anyVersionExists) {
      console.warn(
        `[PrepAnalysis] prompt.md failed validation — keeping current DB version. Errors: ${validation.errors.map((e) => e.message).join("; ")}`
      );
      return;
    }
    throw new Error(
      `Default prep prompt.md failed validation: ${validation.errors.map((e) => e.message).join("; ")}`
    );
  }

  const nextVersion = await getNextVersionNumber();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.prepAnalysisPromptVersion.updateMany({
        where: { is_active: true },
        data: { is_active: false },
      });
      await tx.prepAnalysisPromptVersion.create({
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
      invalidatePromptCache();
      console.warn(
        `[PrepAnalysis] Prompt sync race detected (version ${nextVersion}); another instance won.`
      );
      return;
    }
    throw error;
  }

  invalidatePromptCache();
  console.log(
    `[PrepAnalysis] Prompt auto-synced to version ${nextVersion} from prompt.md.`
  );
}

let inFlightSync: Promise<void> | null = null;

async function syncPromptFromFilesystem(): Promise<void> {
  if (inFlightSync) return inFlightSync;
  inFlightSync = performSync().finally(() => {
    inFlightSync = null;
  });
  return inFlightSync;
}

export type PrepAnalysisPromptVersionDto = {
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
  includeContent = true
): PrepAnalysisPromptVersionDto {
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
  return prisma.prepAnalysisPromptVersion.findFirst({
    where: { is_active: true },
    orderBy: { version: "desc" },
  });
}

export const prepAnalysisPromptService = {
  invalidatePromptCache,

  validateContent(content: string) {
    return validatePrepAnalysisPrompt(content);
  },

  async getActiveContent(): Promise<string> {
    const now = Date.now();
    if (promptCache && now - promptCache.loadedAt < CACHE_TTL_MS) {
      return promptCache.content;
    }
    const active = await getActiveRow();
    if (active) {
      promptCache = { content: active.content, loadedAt: now };
      return active.content;
    }
    const fallback = readPromptFromFilesystem();
    promptCache = { content: fallback, loadedAt: now };
    return fallback;
  },

  async getActiveVersion(): Promise<PrepAnalysisPromptVersionDto | null> {
    const active = await getActiveRow();
    return active ? toDto(active) : null;
  },

  async listVersions(): Promise<PrepAnalysisPromptVersionDto[]> {
    await syncPromptFromFilesystem();
    const rows = await prisma.prepAnalysisPromptVersion.findMany({
      orderBy: { version: "desc" },
    });
    return rows.map((row) => toDto(row, false));
  },

  async getVersionById(
    id: string
  ): Promise<PrepAnalysisPromptVersionDto | null> {
    const row = await prisma.prepAnalysisPromptVersion.findUnique({
      where: { id },
    });
    return row ? toDto(row) : null;
  },

  async createVersion(params: {
    content: string;
    note?: string;
    createdBy?: string;
    activate?: boolean;
  }): Promise<PrepAnalysisPromptVersionDto> {
    const validation = validatePrepAnalysisPrompt(params.content);
    if (!validation.valid) {
      throw new Error(validation.errors.map((issue) => issue.message).join(" "));
    }

    const version = await getNextVersionNumber();
    const shouldActivate = params.activate ?? true;

    const created = await prisma.$transaction(async (tx) => {
      if (shouldActivate) {
        await tx.prepAnalysisPromptVersion.updateMany({
          where: { is_active: true },
          data: { is_active: false },
        });
      }
      return tx.prepAnalysisPromptVersion.create({
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

  async activateVersion(id: string): Promise<PrepAnalysisPromptVersionDto> {
    const target = await prisma.prepAnalysisPromptVersion.findUnique({
      where: { id },
    });
    if (!target) {
      throw new Error("Prompt version not found");
    }

    const validation = validatePrepAnalysisPrompt(target.content);
    if (!validation.valid) {
      throw new Error(validation.errors.map((issue) => issue.message).join(" "));
    }

    const activated = await prisma.$transaction(async (tx) => {
      await tx.prepAnalysisPromptVersion.updateMany({
        where: { is_active: true },
        data: { is_active: false },
      });
      return tx.prepAnalysisPromptVersion.update({
        where: { id },
        data: { is_active: true },
      });
    });

    invalidatePromptCache();
    return toDto(activated);
  },
};
