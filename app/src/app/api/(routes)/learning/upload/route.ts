import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { uploadLearningMedia } from "@/app/api/utils/fileStorage";

// Grote uploads (video's tot 500MB) draaien op de Node-runtime, niet de edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Limieten 1-op-1 met productie (server/routes.ts multer-config) + een
// MIME-prefix per soort: bestanden gaan naar de PUBLIEKE DAM, dus we laten geen
// willekeurige types (bv. .html/.svg) toe die daar als actieve inhoud kunnen
// worden geserveerd.
const LIMITS: Record<
  string,
  { maxBytes: number; mimePrefixes?: string[] }
> = {
  video: { maxBytes: 500 * 1024 * 1024, mimePrefixes: ["video/"] },
  image: { maxBytes: 500 * 1024 * 1024, mimePrefixes: ["image/"] },
  thumbnail: { maxBytes: 5 * 1024 * 1024, mimePrefixes: ["image/"] },
  document: {
    maxBytes: 200 * 1024 * 1024,
    mimePrefixes: ["application/", "text/"],
  },
};

/**
 * POST /api/learning/upload  (learning_admin+)
 * Multipart-formdata: `file` = bestand, `kind` = video|image|thumbnail|document.
 * Uploadt naar de DAM (lms-reppic/public) en geeft de publieke URL terug.
 * Vervangt de losse productie-endpoints /api/upload/video|image|thumbnail.
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

  const fileEntry = formData.get("file");
  const kind = String(formData.get("kind") || "video");
  const limit = LIMITS[kind] || LIMITS.video;

  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json({ message: "no_file" }, { status: 400 });
  }

  const mimeType = fileEntry.type || "application/octet-stream";
  if (
    limit.mimePrefixes &&
    !limit.mimePrefixes.some((p) => mimeType.startsWith(p))
  ) {
    return NextResponse.json({ message: "invalid_type" }, { status: 400 });
  }
  if (fileEntry.size > limit.maxBytes) {
    return NextResponse.json({ message: "file_too_large" }, { status: 400 });
  }

  try {
    const buffer = await fileEntry.arrayBuffer();
    const url = await uploadLearningMedia(buffer, fileEntry.name);
    return NextResponse.json({ data: { url } });
  } catch (error) {
    console.error("[learning/upload] Upload error:", error);
    return NextResponse.json({ message: "upload_failed" }, { status: 500 });
  }
}
