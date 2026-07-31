import { prisma } from "@/app/api/utils/prisma";
import * as XLSX from "xlsx";
import { downloadFileFromFtp } from "@/app/api/utils/fileStorage";

// Type for objection rules with good/bad examples from Excel
export type ObjectionRule = {
  objection: string; // Uitleg - the objection itself
  altPhrasing: string; // AndereBewoordingen - alternative phrasings
  goodExample: string; // VoorbeeldGoedPareren - how to handle it correctly
  badExample: string; // VoorbeeldFoutPareren - how NOT to handle it
};

export type Knowledge = {
  objections: string[];
  objectionRules: ObjectionRule[]; // Full objection rules with examples
  points: string[];
};

type PhaseKey =
  | "opening"
  | "needs_analysis"
  | "offer"
  | "agreement"
  | "objections";

type PromptMeta =
  | {
      kind: "excel";
      filePath: string;
      fileName?: string;
      uploadedAt?: string;
      fileSize?: number;
    }
  | { kind: "text"; content: string };

type CachedKnowledge = {
  phaseMap: Record<PhaseKey, string[]>;
  objectionRules: ObjectionRule[]; // Full objection rules with examples
  /** Replit-style block: Fases sheet, Fase=3 rows, Titel + GoedVoorbeeld only */
  aanbodFasesCriteriaSnippet: string;
  sourceKey: string;
  loadedAt: number;
};
const knowledgeCache: Record<string, CachedKnowledge> = {};
let promptMetaCache: Record<string, PromptMeta | null> = {};
let promptMetaLoadedAt = 0;

const META_TTL = 60_000;

const PHASE_KEYWORDS: Record<Exclude<PhaseKey, "objections">, string[]> = {
  opening: [
    "opening",
    "intro",
    "welcome",
    "start",
    "debout",
    "inicio",
    "anfang",
  ],
  needs_analysis: [
    "need",
    "behoefte",
    "analyse",
    "analysis",
    "analyse",
    "bedarf",
    "behoefteanalyse",
  ],
  offer: [
    "offer",
    "aanbod",
    "propose",
    "proposal",
    "angebot",
    "offre",
    "oferta",
    "offerta",
  ],
  agreement: [
    "agreement",
    "overeen",
    "closing",
    "deal",
    "accord",
    "convenio",
    "akkoord",
  ],
};

const OBJECTION_HINTS = [
  "objection",
  "weerstand",
  "weerst",
  "resistance",
  "einwand",
  "obiezioni",
  "objeciones",
];

const NUMBER_PHASE_MAP: Record<number, PhaseKey> = {
  1: "opening",
  2: "needs_analysis",
  3: "offer",
  4: "agreement",
  5: "objections",
};

const SUPPORTED_PHASE_KEYS: PhaseKey[] = [
  "opening",
  "needs_analysis",
  "offer",
  "agreement",
  "objections",
];

function emptyPhaseMap(): Record<PhaseKey, string[]> {
  return {
    opening: [],
    needs_analysis: [],
    offer: [],
    agreement: [],
    objections: [],
  };
}

function normalizeLangCode(lang: string): string {
  const lower = String(lang || "en").toLowerCase();
  if (lower.startsWith("nl")) return "nl";
  return lower.slice(0, 2) || "en";
}

function parsePromptValue(value?: string | null): PromptMeta | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      const filePath =
        parsed?.filePath ||
        parsed?.path ||
        parsed?.ftpPath ||
        parsed?.relativePath;
      const type = parsed?.type || parsed?.kind;
      if ((type === "excel" && filePath) || filePath) {
        return {
          kind: "excel",
          filePath: String(filePath),
          fileName: parsed?.fileName || parsed?.name,
          uploadedAt: parsed?.uploadedAt,
          fileSize: parsed?.fileSize,
        };
      }
    } catch (error) {
      // If parsing fails, fall through to treat as plain text
    }
  }
  return { kind: "text", content: raw };
}

async function refreshPromptMeta(force = false) {
  const now = Date.now();
  if (
    !force &&
    promptMetaLoadedAt &&
    now - promptMetaLoadedAt < META_TTL &&
    Object.keys(promptMetaCache).length
  ) {
    return promptMetaCache;
  }
  const rows = await prisma.prompt.findMany({
    orderBy: { updated_at: "desc" },
  });
  const next: Record<string, PromptMeta | null> = {};
  for (const row of rows) {
    const lang = normalizeLangCode(row.lang_code || "en");
    if (next[lang] !== undefined) continue;
    next[lang] = parsePromptValue(row.prompt);
  }
  promptMetaCache = next;
  promptMetaLoadedAt = now;
  return promptMetaCache;
}

function listFromText(content: string): Record<PhaseKey, string[]> {
  const base = content
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const map = emptyPhaseMap();
  for (const key of SUPPORTED_PHASE_KEYS) {
    map[key] = key === "objections" ? [] : [...base];
  }
  return map;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function dedupePhaseMap(
  map: Record<PhaseKey, string[]>
): Record<PhaseKey, string[]> {
  const next = emptyPhaseMap();
  for (const key of SUPPORTED_PHASE_KEYS) {
    next[key] = dedupe(map[key] || []);
  }
  return next;
}

function sheetToLines(ws: XLSX.WorkSheet, firstColumnOnly = false): string[] {
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  }) as (string | number)[][];
  return rows
    .map((row) => {
      if (firstColumnOnly) {
        // For objections: only take the first column (the actual objection text)
        return String(row[0] ?? "").trim();
      }
      return row
        .map((cell) => String(cell ?? "").trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter(Boolean);
}

function detectPhaseFromName(name: string): PhaseKey | null {
  const normalized = name.toLowerCase();
  if (OBJECTION_HINTS.some((hint) => normalized.includes(hint)))
    return "objections";
  for (const [phase, keywords] of Object.entries(PHASE_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return phase as PhaseKey;
    }
  }
  return null;
}

/** Sheet names that Replit uses for phase learning rows (Fase column). */
function isFasesSheetName(normalizedLower: string): boolean {
  return (
    normalizedLower === "fases" ||
    normalizedLower === "phases" ||
    normalizedLower === "phasen"
  );
}

/** Numeric Fase/Phase column 1–5, or null. */
function getNumericFaseFromRow(row: Record<string, any>): number | null {
  const candidates = [
    row?.Fase,
    row?.fase,
    row?.Phase,
    row?.phase,
  ];
  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue;
    if (typeof candidate === "number" && candidate >= 1 && candidate <= 5) {
      return candidate;
    }
    const n = parseInt(String(candidate).replace(/\D+/g, ""), 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 5) return n;
  }
  return null;
}

function detectPhaseFromRow(row: Record<string, any>): PhaseKey | null {
  const candidates = [
    row?.Fase,
    row?.fase,
    row?.Phase,
    row?.phase,
    row?.PhaseName,
    row?.FaseNaam,
    row?.FaseNaamEngels,
  ];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === "number" && NUMBER_PHASE_MAP[candidate]) {
      return NUMBER_PHASE_MAP[candidate];
    }
    const text = String(candidate).toLowerCase();
    const numeric = parseInt(text.replace(/\D+/g, ""), 10);
    if (!Number.isNaN(numeric) && NUMBER_PHASE_MAP[numeric]) {
      return NUMBER_PHASE_MAP[numeric];
    }
    const byName = detectPhaseFromName(text);
    if (byName) return byName;
  }
  return null;
}

function summarizeStructuredRow(row: Record<string, any>): string {
  const parts: string[] = [];
  const nummer = row?.Nummer || row?.Number;
  const title = row?.Titel || row?.Title;
  const goal = row?.Doel || row?.Goal;
  const analysis = row?.AnalysePunten || row?.Analysis || row?.AnalysisPoints;
  const good = row?.GoedVoorbeeld || row?.GoodExample;
  const partial = row?.DeelsGoedVoorbeeld || row?.PartialExample;
  const bad = row?.FoutVoorbeeld || row?.BadExample;
  const instruction = row?.Instructies || row?.Instructions;

  if (nummer || title) {
    parts.push([nummer, title].filter(Boolean).join(". ").trim());
  }
  if (goal) parts.push(`Goal: ${goal}`);
  if (analysis) parts.push(`Analysis: ${analysis}`);
  if (good) parts.push(`✅ ${good}`);
  if (partial) parts.push(`⚠️ ${partial}`);
  if (bad) parts.push(`❌ ${bad}`);
  if (instruction) parts.push(`Instruction: ${instruction}`);

  return parts.join(" | ").trim();
}

function extractObjectionFromRow(row: Record<string, any>): string | null {
  const candidates = [
    row?.Weerstand,
    row?.Weerstanden,
    row?.Objection,
    row?.Objections,
    row?.Resistance,
  ];
  for (const candidate of candidates) {
    if (candidate && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }
  return null;
}

function parseWorkbook(buffer: Buffer) {
  // Validate buffer before parsing
  if (!buffer || buffer.length === 0) {
    console.warn(
      "[knowledge] Empty buffer received, returning empty phase map"
    );
    return {
      phaseMap: emptyPhaseMap(),
      objectionRules: [],
      aanbodFasesCriteriaSnippet: "",
    };
  }

  // Check for Excel magic bytes (PK = ZIP header, Excel files are ZIP archives)
  const header = buffer.slice(0, 4).toString("hex");
  if (header !== "504b0304") {
    console.warn(
      `[knowledge] Invalid Excel file header: ${header.substring(
        0,
        20
      )}..., buffer length: ${buffer.length}, returning empty phase map`
    );
    return {
      phaseMap: emptyPhaseMap(),
      objectionRules: [],
      aanbodFasesCriteriaSnippet: "",
    };
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const phaseMap = emptyPhaseMap();
  const objectionRules: ObjectionRule[] = [];
  const aanbodFasesLines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    const normalizedSheetName = sheetName.trim().toLowerCase();
    if (!normalizedSheetName) continue;

    // Check if this is the Weerstanden/Objections sheet
    const isObjectionsSheet = OBJECTION_HINTS.some((hint) =>
      normalizedSheetName.includes(hint)
    );

    if (isObjectionsSheet) {
      // Parse objections with full examples
      const structuredRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
        defval: "",
      });

      for (const row of structuredRows) {
        // Extract objection text (Uitleg column)
        const objectionText = String(
          row?.Uitleg || row?.Weerstand || row?.Objection || ""
        ).trim();

        if (objectionText) {
          // Add to simple objections list
          phaseMap.objections.push(objectionText);

          // Add to full objection rules with examples
          const rule: ObjectionRule = {
            objection: objectionText,
            altPhrasing: String(
              row?.AndereBewoordingen || row?.AltPhrasing || ""
            ).trim(),
            goodExample: String(
              row?.VoorbeeldGoedPareren || row?.GoodExample || ""
            ).trim(),
            badExample: String(
              row?.VoorbeeldFoutPareren || row?.BadExample || ""
            ).trim(),
          };

          // Only add if we have at least the objection and one example
          if (rule.goodExample || rule.badExample) {
            objectionRules.push(rule);
            console.log(
              `[knowledge] Loaded objection rule: "${objectionText.substring(
                0,
                40
              )}..." with examples`
            );
          }
        }
      }
      continue;
    }

    const structuredRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
      defval: "",
    });
    const hasStructuredPhase =
      structuredRows.length > 0 &&
      Object.keys(structuredRows[0]).some((key) => /fase|phase/i.test(key));
    if (hasStructuredPhase) {
      if (isFasesSheetName(normalizedSheetName)) {
        for (const row of structuredRows) {
          if (getNumericFaseFromRow(row) !== 3) continue;
          const titel = String(row?.Titel || row?.Title || "").trim();
          const goed = String(
            row?.GoedVoorbeeld || row?.GoodExample || ""
          ).trim();
          if (titel && goed) {
            aanbodFasesLines.push(`- ${titel}: ${goed}`);
          }
        }
      }
      for (const row of structuredRows) {
        const phaseKey = detectPhaseFromRow(row) || "opening";
        const summary = summarizeStructuredRow(row);
        if (summary) {
          phaseMap[phaseKey].push(summary);
        }
        const objection = extractObjectionFromRow(row);
        if (objection) phaseMap.objections.push(objection);
      }
      continue;
    }

    const phaseKey = detectPhaseFromName(normalizedSheetName) || "opening";
    const lines = sheetToLines(ws, false);
    phaseMap[phaseKey].push(...lines);
  }

  const aanbodFasesCriteriaSnippet =
    aanbodFasesLines.length > 0
      ? `\n\nKENNIS UIT TRAINING DOCUMENT (Aanbod fase criteria):\n${aanbodFasesLines.join("\n")}`
      : "";

  console.log(
    `[knowledge] Parsed ${objectionRules.length} objection rules with examples; aanbod Fases criteria lines: ${aanbodFasesLines.length}`
  );
  return {
    phaseMap: dedupePhaseMap(phaseMap),
    objectionRules,
    aanbodFasesCriteriaSnippet,
  };
}

async function ensureKnowledgeLoadedForLang(lang: string, force = false) {
  await refreshPromptMeta(force);
  const meta = promptMetaCache[lang];
  if (!meta) {
    if (!knowledgeCache[lang] || force) {
      knowledgeCache[lang] = {
        phaseMap: emptyPhaseMap(),
        objectionRules: [],
        aanbodFasesCriteriaSnippet: "",
        sourceKey: `empty:${lang}`,
        loadedAt: Date.now(),
      };
    }
    return knowledgeCache[lang];
  }

  const sourceKey =
    meta.kind === "excel"
      ? `excel:${meta.filePath}:${meta.uploadedAt || ""}`
      : `text:${meta.content}`;

  if (
    !force &&
    knowledgeCache[lang] &&
    knowledgeCache[lang].sourceKey === sourceKey
  ) {
    return knowledgeCache[lang];
  }

  try {
    let phaseMap: Record<PhaseKey, string[]> = emptyPhaseMap();
    let objectionRules: ObjectionRule[] = [];
    let aanbodFasesCriteriaSnippet = "";

    if (meta.kind === "excel" && meta.filePath) {
      const buffer = await downloadFileFromFtp(meta.filePath);
      const parsed = parseWorkbook(buffer);
      phaseMap = parsed.phaseMap;
      objectionRules = parsed.objectionRules;
      aanbodFasesCriteriaSnippet = parsed.aanbodFasesCriteriaSnippet;
    } else if (meta.kind === "text") {
      phaseMap = listFromText(meta.content);
    }

    knowledgeCache[lang] = {
      phaseMap,
      objectionRules,
      aanbodFasesCriteriaSnippet,
      sourceKey,
      loadedAt: Date.now(),
    };
  } catch (error) {
    console.error(`[knowledge] Failed to load knowledge for ${lang}`, error);
    knowledgeCache[lang] = {
      phaseMap: emptyPhaseMap(),
      objectionRules: [],
      aanbodFasesCriteriaSnippet: "",
      sourceKey,
      loadedAt: Date.now(),
    };
  }

  return knowledgeCache[lang];
}

export async function loadKnowledge(force = false) {
  await refreshPromptMeta(force);
  const langs = Object.keys(promptMetaCache);
  await Promise.all(
    langs.map((lang) => ensureKnowledgeLoadedForLang(lang, force))
  );
}

export async function getKnowledgeFor(
  lang: string,
  phase: string
): Promise<Knowledge> {
  const normalizedLang = normalizeLangCode(lang);
  const normalizedPhase = (phase || "opening").toLowerCase() as PhaseKey;
  await ensureKnowledgeLoadedForLang(normalizedLang);
  const cache = knowledgeCache[normalizedLang];
  if (!cache) return { objections: [], objectionRules: [], points: [] };
  const phasePoints =
    cache.phaseMap[normalizedPhase] || cache.phaseMap.opening || [];
  const objections = cache.phaseMap.objections || [];
  const objectionRules = cache.objectionRules || [];
  return { objections, objectionRules, points: phasePoints };
}

/**
 * Replit-style training criteria for offer-phase UBR validation (Fases sheet, Fase 3, Titel + GoedVoorbeeld).
 */
export async function getAanbodFasesValidationContext(
  lang: string
): Promise<string> {
  const normalizedLang = normalizeLangCode(lang);
  await ensureKnowledgeLoadedForLang(normalizedLang);
  const cache = knowledgeCache[normalizedLang];
  return cache?.aanbodFasesCriteriaSnippet || "";
}
