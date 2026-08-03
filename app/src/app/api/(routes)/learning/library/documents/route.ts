import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { learningLibraryService } from "@/lib/services/learningLibraryService";
import { LEARNING_ROLE } from "@/configs/constants";

function toResponse(result: any) {
  if ("error" in result) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "invalid"
          ? 400
          : result.error === "no_knowledge_access"
            ? 402
            : 403;
    return NextResponse.json({ message: result.error }, { status });
  }
  return NextResponse.json({ data: result.data });
}

/** GET /api/learning/library/documents?search=&category=&company_id= */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const sp = req.nextUrl.searchParams;
  return toResponse(
    await learningLibraryService.getDocuments(user, {
      search: sp.get("search") || undefined,
      categoryId: sp.get("category") || undefined,
      companyId: sp.get("company_id"),
    }),
  );
}

/**
 * POST — document aanmaken (beheer). Multipart-formdata:
 * velden title/description/category_id/content_type/external_url/tags(json)
 * + optioneel bestand onder "file".
 */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const formData = await req.formData();
  const fileEntry = formData.get("file");

  let file = null;
  if (fileEntry && typeof fileEntry !== "string") {
    file = {
      buffer: await fileEntry.arrayBuffer(),
      name: fileEntry.name,
      mimeType: fileEntry.type || "application/octet-stream",
      size: fileEntry.size,
    };
  }

  let tags: string[] | null = null;
  const rawTags = formData.get("tags");
  if (typeof rawTags === "string" && rawTags.trim()) {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) tags = parsed.map(String);
    } catch {
      tags = rawTags.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }

  const companyId = req.nextUrl.searchParams.get("company_id");
  return toResponse(
    await learningLibraryService.upsertDocument(
      user,
      {
        id: (formData.get("id") as string) || undefined,
        title: (formData.get("title") as string) || "",
        description: (formData.get("description") as string) || null,
        category_id: (formData.get("category_id") as string) || null,
        content_type: (formData.get("content_type") as string) || "document",
        external_url: (formData.get("external_url") as string) || null,
        tags,
        is_published: formData.get("is_published") !== "false",
      },
      file,
      companyId,
    ),
  );
}
