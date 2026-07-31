import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

export type Knowledge = {
  objections: Record<string, string[]>;
  points: Record<string, Record<string, string[]>>;
};

let cache: Knowledge | null = null;
let lastLoad = 0;

const OBJECTION_SHEET_NAMES = [
  "Weerstanden",
  "Objections",
  "Resistances",
  "Widerstände",
  "Obiezioni",
  "Objeciones",
];

function findExcelRoot(): string | null {
  const cwd = process.cwd();
  const candidates = [path.join(cwd, "public", "excel"), path.join(cwd, "excel")];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

function textifySheet(ws: XLSX.WorkSheet): string[] {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const lines: string[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null) row.push(String(cell.v));
    }
    const joined = row.join(" ").trim();
    if (joined) lines.push(joined);
  }
  return lines;
}

export function loadKnowledge(force = false): Knowledge {
  if (!force && cache && Date.now() - lastLoad < 60_000) return cache;
  const root = findExcelRoot();
  const result: Knowledge = { objections: {}, points: {} };
  if (!root) {
    cache = result;
    lastLoad = Date.now();
    return result;
  }
  const files = fs.readdirSync(root).filter((f) => /\.xlsx?$/.test(f));
  for (const file of files) {
    try {
      const full = path.join(root, file);
      const wb = XLSX.read(fs.readFileSync(full));
      const lower = file.toLowerCase();
      const lang = lower.includes("_nl") || lower.includes("-nl")
        ? "nl"
        : lower.includes("_en") || lower.includes("-en")
        ? "en"
        : lower.includes("_de") || lower.includes("-de")
        ? "de"
        : lower.includes("_fr") || lower.includes("-fr")
        ? "fr"
        : lower.includes("_it") || lower.includes("-it")
        ? "it"
        : lower.includes("_es") || lower.includes("-es")
        ? "es"
        : "en";

      result.objections[lang] ||= [] as any;
      result.points[lang] ||= {} as any;

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const lines = textifySheet(ws);
        if (OBJECTION_SHEET_NAMES.some((n) => n.toLowerCase() === sheetName.toLowerCase())) {
          result.objections[lang].push(...lines.filter(Boolean));
          continue;
        }
        const name = sheetName.toLowerCase();
        let phase: string | null = null;
        if (name.includes("opening") || name.includes("intro")) phase = "opening";
        else if (name.includes("behoefte") || name.includes("needs")) phase = "needs_analysis";
        else if (name.includes("aanbod") || name.includes("offer")) phase = "offer";
        else if (name.includes("overeen") || name.includes("agree")) phase = "agreement";
        else if (name.includes("weerstand") || name.includes("objection")) phase = "objections";
        if (phase) {
          result.points[lang][phase] ||= [];
          result.points[lang][phase].push(...lines);
        }
      }
    } catch {}
  }
  cache = result;
  lastLoad = Date.now();
  return result;
}

export function getKnowledgeFor(lang: string, phase: string) {
  const k = loadKnowledge();
  const l = lang.toLowerCase().startsWith("nl") ? "nl" : lang.slice(0, 2);
  return {
    objections: k.objections[l] || [],
    points: (k.points[l] && k.points[l][phase]) || [],
  };
}
