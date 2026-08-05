/**
 * AI-modulegeneratie (LMS 1:1 P2) — port van de productie-LMS
 * (server/ai.ts generateModuleFromDocument + document-parser.ts +
 * audio-transcription.ts + /api/generate-module in server/routes.ts).
 *
 * Flow: bestand (pdf/doc/docx/ppt/pptx/mp3/wav/m4a/ogg/mp4/mov/webm) →
 * tekst (parser of Whisper-transcriptie) → taaldetectie + vertaling naar
 * Engels → modulegeneratie (titel, beschrijving, categorie, duur, ≥15
 * quizvragen met 4 opties) → gevalideerd + geshuffled resultaat.
 *
 * Afwijking t.o.v. productie (bewuste keuze Marcel 2026-08-05): de
 * TEKSTGENERATIE loopt via de LiteLLM-gateway (completeChat + superadmin-
 * modelpicker lms_modulegen_litellm_model) i.p.v. directe OpenAI-calls.
 * Whisper-transcriptie gebruikt wél direct OpenAI (OPENAI_API_KEY), want de
 * gateway heeft geen audio-endpoint.
 */
import { PLATFORM_SETTING_KEYS } from "@/configs/constants";
import { completeChat } from "@/app/api/services/litellmClient";
import { getLmsChatRoute } from "@/app/api/services/learningModelSettingsService";

export interface GeneratedQuestion {
  question: string;
  options: string[]; // altijd 4 opties (a-d)
  correctAnswer: number; // index 0-3
}

export interface GeneratedModule {
  title: string;
  description: string;
  category: string;
  duration: number; // minuten: 15/30/45/60
  questions: GeneratedQuestion[];
  contentType?: string;
  embedCode?: string;
}

const DOC_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "ogg"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm"];

export const ALL_GENERATION_EXTENSIONS = [
  ...DOC_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
];

export function fileExtension(filename: string): string {
  return filename.toLowerCase().split(".").pop() || "";
}

export function isAudioOrVideo(filename: string): boolean {
  const ext = fileExtension(filename);
  return AUDIO_EXTENSIONS.includes(ext) || VIDEO_EXTENSIONS.includes(ext);
}

// ─────────────────────────── tekstextractie ───────────────────────────

/** Tekst uit pdf/doc/docx/ppt/pptx — 1-op-1 met productie document-parser.ts. */
export async function extractTextFromDocument(
  buffer: Buffer,
  filename: string,
): Promise<{ text: string; pageCount?: number }> {
  const ext = fileExtension(filename);
  switch (ext) {
    case "pdf": {
      // Direct de lib importeren (zelfde patroon als learningEmbeddingsService):
      // de package-index van pdf-parse draait debug-code bij import.
      const pdfModule: any = await import("pdf-parse/lib/pdf-parse.js");
      const pdfParse = (pdfModule.default || pdfModule) as (
        b: Buffer,
      ) => Promise<{ text: string; numpages?: number }>;
      const data = await pdfParse(buffer);
      return { text: data.text.trim(), pageCount: data.numpages };
    }
    case "doc":
    case "docx": {
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value.trim() };
    }
    case "ppt":
    case "pptx": {
      const officeParser: any = (await import("officeparser")).default;
      const text: string = await officeParser.parseOfficeAsync(buffer);
      return { text: String(text || "").trim() };
    }
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

/** Afkappen op ~tokens (4 chars/token) — 1-op-1 met productie truncateText. */
export function truncateText(text: string, maxTokens = 8000): string {
  const maxChars = maxTokens * 4;
  return text.length <= maxChars ? text : text.substring(0, maxChars) + "…";
}

// ─────────────────────── audio/video-transcriptie ───────────────────────

/**
 * Whisper-transcriptie (direct OpenAI; gateway heeft geen audio-endpoint).
 * Bestanden >25MB worden met ffmpeg in ~15MB-mp3-chunks geknipt (64k bitrate),
 * elk apart getranscribeerd en samengevoegd — 1-op-1 met productie.
 */
export async function transcribeAudio(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("transcription_unavailable"); // geen OPENAI_API_KEY gezet
  }
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });

  const MAX_SIZE = 25 * 1024 * 1024;
  const buffers =
    buffer.length > MAX_SIZE
      ? await splitAudioIntoChunks(buffer, filename)
      : [buffer];

  const parts: string[] = [];
  for (let i = 0; i < buffers.length; i++) {
    const name = buffers.length > 1 ? `chunk_${i}.mp3` : filename;
    const type = buffers.length > 1 ? "audio/mpeg" : mimeTypeFor(filename);
    const file = new File([new Uint8Array(buffers[i])], name, { type });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "text",
    });
    parts.push(
      typeof transcription === "string" ? transcription : String(transcription),
    );
  }

  const combined = parts.join(" ").trim();
  if (!combined) throw new Error("Transcriptie leverde geen tekst op");
  return combined;
}

function mimeTypeFor(filename: string): string {
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    webm: "audio/webm",
    mp4: "video/mp4",
    mov: "video/quicktime",
  };
  return map[fileExtension(filename)] || "application/octet-stream";
}

async function splitAudioIntoChunks(
  buffer: Buffer,
  filename: string,
): Promise<Buffer[]> {
  const [{ default: ffmpeg }, fs, path, os] = await Promise.all([
    import("fluent-ffmpeg"),
    import("fs/promises"),
    import("path"),
    import("os"),
  ]);
  // Zelfde patroon als audioChunkingService: FFMPEG_PATH uit env indien gezet.
  if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);

  const tmpDir = os.tmpdir();
  const stamp = Date.now();
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  const inputPath = path.join(tmpDir, `modgen_in_${stamp}_${safeName}`);
  const outputPattern = path.join(tmpDir, `modgen_chunk_${stamp}_%03d.mp3`);

  try {
    await fs.writeFile(inputPath, buffer);

    // Chunkduur schatten: doel ~15MB per chunk (zoals productie).
    const targetChunkSize = 15 * 1024 * 1024;
    const estimatedChunks = Math.ceil(buffer.length / targetChunkSize);
    const estimatedTotalMinutes = (buffer.length / (26 * 1024 * 1024)) * 30;
    const chunkDurationSeconds = Math.max(
      60,
      Math.ceil((estimatedTotalMinutes * 60) / estimatedChunks),
    );

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec("libmp3lame")
        .audioBitrate("64k")
        .outputOptions([
          "-f segment",
          `-segment_time ${chunkDurationSeconds}`,
          "-reset_timestamps 1",
        ])
        .output(outputPattern)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    const chunks: Buffer[] = [];
    for (let i = 0; ; i++) {
      const chunkPath = path.join(
        tmpDir,
        `modgen_chunk_${stamp}_${String(i).padStart(3, "0")}.mp3`,
      );
      try {
        chunks.push(await fs.readFile(chunkPath));
        await fs.unlink(chunkPath).catch(() => {});
      } catch {
        break;
      }
    }
    if (chunks.length === 0) throw new Error("Audio chunking failed");
    return chunks;
  } finally {
    const fsMod = await import("fs/promises");
    await fsMod.unlink(inputPath).catch(() => {});
  }
}

// ────────────────────────── LLM-stappen (gateway) ──────────────────────────

async function modulegenRoute() {
  return getLmsChatRoute(PLATFORM_SETTING_KEYS.LMS_MODULEGEN_LITELLM_MODEL);
}

function parseJsonObject(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    // Soms komt JSON in een ```-blok terug; laatste redmiddel: object uitknippen.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI response was not valid JSON");
  }
}

/**
 * Taaldetectie + vertaling naar Engels — 1-op-1 met productie
 * detectLanguageAndTranslateToEnglish, maar via de gateway.
 */
export async function detectLanguageAndTranslateToEnglish(
  text: string,
): Promise<{ language: string; translatedText: string }> {
  const route = await modulegenRoute();
  try {
    const detectionPrompt = `You are a language detection expert. Detect the language of the following text sample.

Text sample:
${text.substring(0, 2000)}

Return a JSON object with:
- language: ISO 639-1 code (en, nl, de, fr, es, it, etc.)
- isEnglish: true if the text is in English, false otherwise`;

    const detection = parseJsonObject(
      await completeChat(detectionPrompt, undefined, route),
    );
    if (detection.isEnglish) return { language: "en", translatedText: text };

    const translationPrompt = `You are a professional translator. Translate the following ${detection.language} text to English. Preserve all technical terms, product names, and formatting.

Text to translate:
${text}

Return a JSON object with exactly one key:
{ "translation": "<the full English translation>" }`;

    const translated = parseJsonObject(
      await completeChat(translationPrompt, undefined, route),
    );
    return {
      language: detection.language || "unknown",
      translatedText:
        typeof translated.translation === "string" && translated.translation
          ? translated.translation
          : text,
    };
  } catch (error) {
    console.error("[modulegen] language detection/translation error:", error);
    return { language: "en", translatedText: text }; // fallback zoals productie
  }
}

/**
 * Kern: module + quizvragen genereren uit tekst — prompt, validatie en
 * antwoord-shuffle 1-op-1 met productie generateModuleFromDocument.
 */
export async function generateModuleFromDocument(
  documentText: string,
  filename: string,
): Promise<GeneratedModule> {
  const { translatedText } =
    await detectLanguageAndTranslateToEnglish(documentText);

  const prompt = `
You are an expert in creating educational content. Analyze the following document and generate a learning module with multiple choice questions.

Document: ${filename}
Content:
${translatedText}

Create a module with the following specifications:
1. A clear title (max 60 characters)
2. A description that summarizes what employees will learn (max 200 characters)
3. Estimate duration in minutes (15, 30, 45, or 60 minutes)
4. Determine the category: "product-knowledge", "service-knowledge", "market-knowledge", "sales-skills", or "general"
5. Generate at least 15 multiple choice questions with ALWAYS 4 answer options
6. For each question, indicate which answer is correct (0 = first option, 3 = last option)

IMPORTANT:
- Questions must be specific about the document content
- Answer options must be realistic and plausible
- Ensure there are always exactly 4 answer options
- Questions should test knowledge, not just facts
- Use English language for ALL content (title, description, questions, answers)
- Answer options are PLAIN TEXT without any letter prefix (no "a)", "b)" etc.)
- Return STRICTLY VALID JSON; never put unescaped double quotes inside strings

Return the module as JSON with this exact structure:
{
  "title": "...",
  "description": "...",
  "category": "...",
  "duration": 30,
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": 0
    }
  ]
}
`;

  const route = await modulegenRoute();
  // Productie gebruikte OpenAI's strikte json_object-mode; via de gateway kan
  // een model heel af en toe tóch ongeldige JSON leveren. Eén herkansing met
  // een expliciete correctie-instructie vangt dat op.
  let result: any;
  try {
    result = parseJsonObject(await completeChat(prompt, undefined, route));
  } catch {
    result = parseJsonObject(
      await completeChat(
        `${prompt}\n\nIMPORTANT: Your previous attempt produced invalid JSON. Respond with STRICTLY valid JSON only — no markdown fences, no text outside the JSON object.`,
        undefined,
        route,
      ),
    );
  }

  if (!result.questions || !Array.isArray(result.questions)) {
    throw new Error("AI genereerde geen geldige vragen");
  }

  // Antwoorden shufflen met behoud van het juiste antwoord (Fisher-Yates).
  const shuffleOptions = (q: GeneratedQuestion): GeneratedQuestion => {
    const indexed = q.options.map((text, index) => ({ text, index }));
    for (let i = indexed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
    }
    return {
      question: q.question,
      options: indexed.map((o) => o.text),
      correctAnswer: indexed.findIndex((o) => o.index === q.correctAnswer),
    };
  };

  const validQuestions: GeneratedQuestion[] = result.questions
    .filter((q: any) => {
      if (!q.question || !q.options || !Array.isArray(q.options)) return false;
      if (q.options.length < 4) return false;
      if (
        typeof q.correctAnswer !== "number" ||
        q.correctAnswer < 0 ||
        q.correctAnswer > 3
      )
        return false;
      return true;
    })
    .map((q: any) => ({
      question: q.question,
      // Eventuele door het model tóch toegevoegde letterprefixen strippen;
      // hieronder (na de shuffle) zetten we ze er deterministisch weer op.
      options: q.options
        .slice(0, 4)
        .map((o: string) => String(o).replace(/^[a-d]\)\s*/i, "")),
      correctAnswer: Math.min(q.correctAnswer, 3),
    }))
    .map(shuffleOptions)
    // Zelfde datavorm als productie: opties als "a) …", "b) …", "c) …", "d) …".
    .map((q: GeneratedQuestion) => ({
      ...q,
      options: q.options.map((o, i) => `${"abcd"[i]}) ${o}`),
    }));

  if (validQuestions.length === 0) {
    throw new Error("AI kon geen geldige vragen genereren uit dit document");
  }

  const validCategories = [
    "product-knowledge",
    "service-knowledge",
    "market-knowledge",
    "sales-skills",
    "general",
  ];
  const category = validCategories.includes(result.category)
    ? result.category
    : "general";

  const validDurations = [15, 30, 45, 60];
  const parsedDuration =
    typeof result.duration === "number" ? result.duration : 30;
  const duration = validDurations.includes(parsedDuration)
    ? parsedDuration
    : validDurations.reduce((prev, curr) =>
        Math.abs(curr - parsedDuration) < Math.abs(prev - parsedDuration)
          ? curr
          : prev,
      );

  const title = (result.title || "Nieuwe Module").substring(0, 100).trim();
  const description = (result.description || "").substring(0, 500).trim();
  if (!title) throw new Error("AI kon geen geldige titel genereren");

  return { title, description, category, duration, questions: validQuestions };
}

// ────────────────────────────── orchestratie ──────────────────────────────

/**
 * Volledige generate-flow voor een geüpload bestand — spiegelt de productie-
 * route /api/generate-module: extensiecheck → tekst (parser/Whisper) →
 * minimaal 100 tekens → afkappen → module genereren.
 */
export async function generateModuleFromUpload(
  buffer: Buffer,
  filename: string,
): Promise<{ module: GeneratedModule; metadata: Record<string, unknown> }> {
  const ext = fileExtension(filename);
  if (!ALL_GENERATION_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported file type. Please upload: ${ALL_GENERATION_EXTENSIONS.join(", ")}`,
    );
  }

  const metadata: Record<string, unknown> = {};
  let extractedText = "";

  if (isAudioOrVideo(filename)) {
    extractedText = await transcribeAudio(buffer, filename);
    metadata.type = AUDIO_EXTENSIONS.includes(ext) ? "audio" : "video";
    metadata.transcriptionLength = extractedText.length;
  } else {
    const extracted = await extractTextFromDocument(buffer, filename);
    extractedText = extracted.text;
    metadata.type = "document";
    metadata.pageCount = extracted.pageCount;
    metadata.extractedLength = extracted.text.length;
  }

  if (!extractedText || extractedText.length < 100) {
    throw new Error("insufficient_text");
  }

  const truncated = truncateText(extractedText, 8000);
  metadata.truncatedLength = truncated.length;

  const module = await generateModuleFromDocument(truncated, filename);
  return { module, metadata };
}
