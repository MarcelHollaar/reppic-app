import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { rateLimit, getClientIp } from "@/app/api/utils/rateLimiter";
import {
  extractDocumentText,
  suggestMappingFromDocument,
} from "@/app/api/services/terminologyDocService";

/**
 * Superadmin-only: propose a terminology mapping from an uploaded training
 * document (or pasted text). Returns a proposal only — nothing is saved; the
 * superadmin reviews it in the table and saves via PUT /superadmin/terminology.
 *
 * Accepts multipart/form-data with either a `file` (.txt/.md/.csv/.docx/.pdf)
 * or a `text` field.
 */

// Uploaded documents can be a few MB (PDF); allow a generous body.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const requester = (req as any).user;
  if (requester?.role?.name !== USER_ROLE.SUPER_ADMIN) {
    return NextResponse.json(
      { error: "Unauthorized: Insufficient permissions" },
      { status: 403 },
    );
  }

  // Document parsing (PDF/DOCX) + AI runs on the whole upload — cap repeated
  // calls to blunt decompression-bomb / cost DoS.
  const rl = rateLimit(`terminology-suggest:${getClientIp(req)}`, 20, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Te veel documentverwerkingen. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let documentText = "";
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const pasted = form.get("text");
      const file = form.get("file");

      if (typeof pasted === "string" && pasted.trim()) {
        documentText = pasted;
      } else if (file && typeof (file as Blob).arrayBuffer === "function") {
        const blob = file as File;
        const buffer = Buffer.from(await blob.arrayBuffer());
        documentText = await extractDocumentText(buffer, blob.name || "");
      }
    } else {
      // JSON fallback: { text }
      const body = await req.json().catch(() => ({}));
      if (typeof body?.text === "string") documentText = body.text;
    }
  } catch (e) {
    if (e instanceof Error && e.message === "UNSUPPORTED_FILETYPE") {
      return NextResponse.json(
        { error: "UNSUPPORTED_FILETYPE" },
        { status: 400 },
      );
    }
    console.error("[terminology] Failed to read document:", e);
    return NextResponse.json(
      { error: "Kon document niet lezen" },
      { status: 400 },
    );
  }

  if (!documentText.trim()) {
    return NextResponse.json(
      { error: "Geen leesbare tekst gevonden" },
      { status: 400 },
    );
  }

  try {
    const { mapping, usedChars } = await suggestMappingFromDocument(
      documentText,
      { userId: requester?.id },
    );
    return NextResponse.json({ mapping, usedChars });
  } catch (e) {
    console.error("[terminology] Suggestion failed:", e);
    return NextResponse.json(
      { error: "Kon geen voorstel genereren" },
      { status: 500 },
    );
  }
}
