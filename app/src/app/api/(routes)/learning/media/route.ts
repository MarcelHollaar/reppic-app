import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { learningMediaService } from "@/lib/services/learningMediaService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 200 * 1024 * 1024;

function errStatus(error: string) {
  return error === "not_found"
    ? 404
    : error === "conversion_failed"
      ? 502
      : 403;
}

/** GET /api/learning/media — media-bibliotheek (superadmin globaal, admin eigen bedrijf). */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const user = (req as any).user;
  return NextResponse.json({ data: await learningMediaService.list(user) });
}

/**
 * POST — media uploaden. Multipart: `file` + optioneel name/tags(json).
 * Office-bestanden worden automatisch naar PDF geconverteerd (pdf_url).
 */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const user = (req as any).user;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "invalid_form" }, { status: 400 });
  }
  const fileEntry = formData.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json({ message: "no_file" }, { status: 400 });
  }
  if (fileEntry.size > MAX_BYTES) {
    return NextResponse.json({ message: "file_too_large" }, { status: 400 });
  }

  let tags: string[] | undefined;
  const rawTags = formData.get("tags");
  if (typeof rawTags === "string" && rawTags.trim()) {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) tags = parsed.map(String);
    } catch {
      tags = rawTags.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }

  try {
    const result = await learningMediaService.upload(
      user,
      {
        buffer: await fileEntry.arrayBuffer(),
        name: fileEntry.name,
        mimeType: fileEntry.type || "application/octet-stream",
        size: fileEntry.size,
      },
      { name: (formData.get("name") as string) || undefined, tags },
    );
    if ("error" in result) {
      return NextResponse.json(
        { message: result.error },
        { status: errStatus(result.error) },
      );
    }
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    console.error("[learning/media] POST failed:", error);
    return NextResponse.json({ message: "upload_failed" }, { status: 500 });
  }
}
