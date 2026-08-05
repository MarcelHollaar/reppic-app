/**
 * Embeddings voor semantisch zoeken in de Kennisbibliotheek (AI-uitbreiding,
 * deel 3 — port van het oude LMS ai-embedding-service, maar via de bestaande
 * LiteLLM-gateway i.p.v. een losse OpenAI-key).
 *
 * Configuratie (allemaal optioneel — zonder LEARNING_EMBEDDINGS_MODEL valt de
 * bibliotheek-zoekfunctie stilzwijgend terug op tekstzoeken):
 *   LEARNING_EMBEDDINGS_MODEL  bv. "text-embedding-3-small" of een
 *                              embedding-alias op de LiteLLM-gateway
 *   LITELLM_BASE_URL/LITELLM_API_KEY  (bestaand) — endpoint /v1/embeddings
 */
import { prisma } from "@/app/api/utils/prisma";
import { getLmsEmbeddingsModel } from "@/app/api/services/learningModelSettingsService";

const EMBED_MAX_CHARS = 8000; // ruwe token-limiet-bescherming

/**
 * Actief embeddings-model: superadmin-keuze uit platform_settings, met
 * terugval op env LEARNING_EMBEDDINGS_MODEL. Null = semantisch zoeken uit.
 */
async function resolveEmbeddingsModel(): Promise<string | null> {
  if (
    !process.env.LITELLM_BASE_URL?.trim() ||
    !process.env.LITELLM_API_KEY?.trim()
  ) {
    return null;
  }
  try {
    return await getLmsEmbeddingsModel();
  } catch {
    return process.env.LEARNING_EMBEDDINGS_MODEL?.trim() || null;
  }
}

// Ook gebruikt door learningPathAnalysisService (P4 module-embeddings).
export async function getEmbedding(
  text: string,
  model: string,
): Promise<number[] | null> {
  // Guard: zonder geconfigureerde gateway niet crashen op undefined.replace,
  // maar netjes null teruggeven (aanroepers vallen dan terug op tekstmatching).
  const rawBase = process.env.LITELLM_BASE_URL;
  if (!rawBase) {
    console.warn("[embeddings] LITELLM_BASE_URL niet gezet — embedding overslaan");
    return null;
  }
  const baseUrl = rawBase.replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LITELLM_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: text.slice(0, EMBED_MAX_CHARS),
      }),
    });
    if (!response.ok) {
      console.error(
        `[learning-embeddings] /v1/embeddings gaf ${response.status}`,
      );
      return null;
    }
    const json = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vector = json.data?.[0]?.embedding;
    return Array.isArray(vector) && vector.length > 0 ? vector : null;
  } catch (err) {
    console.error("[learning-embeddings] embedding-aanroep mislukt:", err);
    return null;
  }
}

// Ook gebruikt door learningPathAnalysisService (P4 module-matching).
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * Best-effort tekst-extractie voor indexering. Ondersteunt platte tekst en
 * docx (mammoth zit al in de app); andere formaten indexeren op
 * titel+beschrijving+tags.
 */
export async function extractTextForIndex(
  file: { buffer: ArrayBuffer; name: string; mimeType: string } | null,
  fallback: { title: string; description?: string | null; tags?: string[] | null },
): Promise<string> {
  const fallbackText = [
    fallback.title,
    fallback.description || "",
    ...(fallback.tags || []),
  ]
    .filter(Boolean)
    .join("\n");

  if (!file) return fallbackText;
  const name = file.name.toLowerCase();
  try {
    if (
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      file.mimeType.startsWith("text/")
    ) {
      const text = Buffer.from(file.buffer).toString("utf8");
      return `${fallbackText}\n${text}`;
    }
    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(file.buffer),
      });
      return `${fallbackText}\n${result.value || ""}`;
    }
    if (name.endsWith(".pdf") || file.mimeType === "application/pdf") {
      // Importeer de lib direct (pdf-parse/lib/pdf-parse.js): de package-index
      // draait bij load debug-code die een testbestand probeert te openen.
      const pdfModule: any = await import("pdf-parse/lib/pdf-parse.js");
      const pdfParse = (pdfModule.default || pdfModule) as (
        buffer: Buffer,
      ) => Promise<{ text?: string }>;
      const result = await pdfParse(Buffer.from(file.buffer));
      return `${fallbackText}\n${result.text || ""}`;
    }
  } catch (err) {
    console.error("[learning-embeddings] tekst-extractie mislukt:", err);
  }
  return fallbackText;
}

/**
 * Indexeer (of herindexeer) een bibliotheekdocument. Stil overslaan als
 * semantisch zoeken niet is geconfigureerd; fouten blokkeren de upload nooit.
 */
export async function indexLibraryDocument(
  documentId: string,
  companyId: string,
  text: string,
): Promise<void> {
  const model = await resolveEmbeddingsModel();
  if (!model || !text.trim()) return;
  const vector = await getEmbedding(text, model);
  if (!vector) return;
  await prisma.libraryDocumentEmbedding.upsert({
    where: { document_id: documentId },
    update: {
      embedding: JSON.stringify(vector),
      text_content: text.slice(0, 20000),
      model,
      company_id: companyId,
    },
    create: {
      document_id: documentId,
      company_id: companyId,
      embedding: JSON.stringify(vector),
      text_content: text.slice(0, 20000),
      model,
    },
  });
}

/**
 * Herindexeer ALLE bestaande bibliotheek-embeddings met het (nieuwe) actieve
 * model, op basis van de eerder opgeslagen text_content. Gebruikt na een
 * modelwissel in de instellingen; draait sequentieel en faalt per document
 * stil (documenten zonder text_content worden overgeslagen).
 */
export async function reindexAllLibraryDocuments(): Promise<{
  reindexed: number;
  skipped: number;
}> {
  const model = await resolveEmbeddingsModel();
  const stats = { reindexed: 0, skipped: 0 };
  if (!model) return stats;

  const rows = await prisma.libraryDocumentEmbedding.findMany({
    select: {
      document_id: true,
      company_id: true,
      text_content: true,
      model: true,
    },
  });
  for (const row of rows) {
    if (row.model === model) continue; // al op het juiste model
    if (!row.text_content?.trim()) {
      stats.skipped++;
      continue;
    }
    try {
      await indexLibraryDocument(
        row.document_id,
        row.company_id,
        row.text_content,
      );
      stats.reindexed++;
    } catch {
      stats.skipped++;
    }
  }
  return stats;
}

/**
 * Semantische zoekopdracht binnen één bedrijf. Retourneert document-id's op
 * volgorde van relevantie, of null als semantisch zoeken niet beschikbaar is
 * (caller valt dan terug op tekstzoeken).
 */
export async function semanticSearchLibrary(
  companyId: string,
  query: string,
  limit = 20,
): Promise<string[] | null> {
  const model = await resolveEmbeddingsModel();
  if (!model) return null;
  const queryVector = await getEmbedding(query, model);
  if (!queryVector) return null;

  // Alleen vectoren van hetzelfde model vergelijken: na een modelwissel zijn
  // oude vectoren onbruikbaar tot her-indexering (zie reindexAllLibraryDocuments).
  const rows = await prisma.libraryDocumentEmbedding.findMany({
    where: { company_id: companyId, model },
    select: { document_id: true, embedding: true },
  });
  if (rows.length === 0) return null;

  return rows
    .map((row) => {
      let vector: number[] = [];
      try {
        vector = JSON.parse(row.embedding);
      } catch {
        /* overslaan */
      }
      return {
        id: row.document_id,
        score: cosineSimilarity(queryVector, vector),
      };
    })
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.id);
}
