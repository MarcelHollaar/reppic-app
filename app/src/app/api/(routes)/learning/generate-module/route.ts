import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { generateModuleFromUpload } from "@/lib/services/learningModuleGenerationService";

// Zware route (upload tot 200MB + transcriptie + LLM): Node-runtime, lange timeout.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 200 * 1024 * 1024; // documentUpload-limiet productie (200MB)

/**
 * POST /api/learning/generate-module  (learning_admin+)
 * Multipart-formdata: `document` = bestand (pdf/doc/docx/ppt/pptx/mp3/wav/
 * m4a/ogg/mp4/mov/webm). Antwoord: { data: { module, metadata } } met een
 * gegenereerde module (titel/beschrijving/categorie/duur/quizvragen) —
 * 1-op-1 met productie /api/generate-module.
 */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "invalid_form" }, { status: 400 });
  }

  const fileEntry = formData.get("document") ?? formData.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json({ message: "no_file" }, { status: 400 });
  }
  if (fileEntry.size > MAX_BYTES) {
    return NextResponse.json({ message: "file_too_large" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const result = await generateModuleFromUpload(buffer, fileEntry.name);
    return NextResponse.json({ data: result });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.startsWith("Unsupported file type")) {
      return NextResponse.json({ message: msg }, { status: 400 });
    }
    if (msg === "insufficient_text") {
      return NextResponse.json(
        { message: "insufficient_text" },
        { status: 400 },
      );
    }
    if (msg === "transcription_unavailable") {
      return NextResponse.json(
        { message: "transcription_unavailable" },
        { status: 503 },
      );
    }
    console.error("[learning/generate-module] failed:", error);
    return NextResponse.json({ message: "generation_failed" }, { status: 500 });
  }
}
