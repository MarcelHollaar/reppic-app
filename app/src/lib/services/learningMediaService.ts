/**
 * Media-bibliotheek / Brand Kit (LMS 1:1 P5) — port van productie
 * /api/media-routes + document-converter.ts (Office→PDF via LibreOffice).
 *
 * Zichtbaarheidsmodel exact als productie:
 *  - superadmin: alleen GLOBALE media (company_id NULL, voor sales-skills);
 *  - learning_admin: alleen media van het eigen bedrijf (knowledge).
 * Office-bestanden (ppt/pptx/doc/docx) worden bij upload automatisch naar
 * PDF geconverteerd (pdf_url) voor inline weergave; vereist `libreoffice`
 * op de server (LIBREOFFICE_PATH overschrijft het commando).
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { randomBytes } from "crypto";
import path from "path";
import os from "os";
import { prisma } from "@/app/api/utils/prisma";
import { uploadLearningMedia } from "@/app/api/utils/fileStorage";
import { USER_ROLE } from "@/configs/constants";

// execFile (geen shell) i.p.v. exec: argumenten worden niet door een shell
// geïnterpreteerd, dus een geprepareerde bestandsnaam kan geen commando's
// injecteren.
const execFileAsync = promisify(execFile);

type AppUser = {
  id: string;
  // De middleware levert role als object { name }; ouder gebruik gaf een string.
  role: string | { name?: string } | null;
  company_id: string | null;
};

const roleName = (u: AppUser): string | undefined =>
  typeof u.role === "string" ? u.role : (u.role?.name ?? undefined);

const isSuperAdmin = (u: AppUser) => roleName(u) === USER_ROLE.SUPER_ADMIN;

// Alleen deze extensies mogen naar LibreOffice (defensief, náást execFile).
const CONVERTIBLE_EXTS = new Set([".ppt", ".pptx", ".doc", ".docx"]);

// ─────────────────────────── Office→PDF (LibreOffice) ───────────────────────

export function isPowerPointFile(mimeType: string, filename: string): boolean {
  const mimes = [
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];
  return (
    mimes.includes(mimeType) ||
    [".ppt", ".pptx"].some((ext) => filename.toLowerCase().endsWith(ext))
  );
}

export function isWordFile(mimeType: string, filename: string): boolean {
  const mimes = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  return (
    mimes.includes(mimeType) ||
    [".doc", ".docx"].some((ext) => filename.toLowerCase().endsWith(ext))
  );
}

/** Office-bestand → PDF-buffer via headless LibreOffice (1-op-1 productie). */
export async function convertOfficeToPDF(
  documentBuffer: Buffer,
  originalFilename: string,
): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
  const fs = await import("fs/promises");
  const tempDir = path.join(os.tmpdir(), "office-conversion");
  const tempId = randomBytes(16).toString("hex");
  // Extensie strikt normaliseren: alleen bekende Office-extensies, anders .bin.
  // Voorkomt dat een geprepareerde bestandsnaam (bv. `x.pptx"; rm -rf …`) ook
  // maar iets geks in het pad zet.
  const rawExt = path.extname(originalFilename).toLowerCase();
  const extension = CONVERTIBLE_EXTS.has(rawExt) ? rawExt : ".bin";
  const inputPath = path.join(tempDir, `${tempId}-input${extension}`);
  const outputDir = path.join(tempDir, tempId);
  const soffice = process.env.LIBREOFFICE_PATH || "libreoffice";

  try {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(inputPath, documentBuffer);

    // execFile met argument-array: geen shell → geen command-injection.
    await execFileAsync(
      soffice,
      ["--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath],
      { timeout: 60000, maxBuffer: 50 * 1024 * 1024 },
    );

    const files = await fs.readdir(outputDir);
    const pdfFile = files.find((f) => f.endsWith(".pdf"));
    if (!pdfFile) {
      throw new Error(`No PDF generated (files: ${JSON.stringify(files)})`);
    }
    const pdfBuffer = await fs.readFile(path.join(outputDir, pdfFile));
    return { success: true, pdfBuffer };
  } catch (error: any) {
    console.error("[media] Office→PDF conversion error:", error?.message);
    return { success: false, error: error?.message || "Conversion failed" };
  } finally {
    const fsMod = await import("fs/promises");
    await fsMod.unlink(inputPath).catch(() => {});
    await fsMod.rm(outputDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─────────────────────────────── CRUD + upload ──────────────────────────────

export const learningMediaService = {
  /** Lijst — superadmin: globaal; admin: eigen bedrijf (productiegedrag). */
  async list(user: AppUser) {
    const where = isSuperAdmin(user)
      ? { company_id: null }
      : { company_id: user.company_id ?? "__none__" };
    return prisma.learningMediaItem.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
  },

  async get(user: AppUser, id: string) {
    const item = await prisma.learningMediaItem.findUnique({ where: { id } });
    if (!item) return { error: "not_found" as const };
    if (isSuperAdmin(user) && item.company_id !== null) {
      return { error: "forbidden" as const };
    }
    if (!isSuperAdmin(user) && item.company_id !== user.company_id) {
      return { error: "forbidden" as const };
    }
    return { data: item };
  },

  /**
   * Upload + registratie in één stap: bestand naar de DAM, Office → ook PDF,
   * daarna media_items-record (samengevoegde port van /api/upload/document +
   * POST /api/media).
   */
  async upload(
    user: AppUser,
    file: { buffer: ArrayBuffer; name: string; mimeType: string; size: number },
    body: { name?: string; tags?: string[] },
  ) {
    const buffer = Buffer.from(file.buffer);
    const url = await uploadLearningMedia(file.buffer, file.name);

    let pdfUrl: string | null = null;
    let mediaType = "document";
    const isPpt = isPowerPointFile(file.mimeType, file.name);
    const isDoc = isWordFile(file.mimeType, file.name);
    if (file.mimeType.startsWith("image/")) mediaType = "image";
    if (file.mimeType.startsWith("video/")) mediaType = "video";

    if (isPpt || isDoc) {
      const conversion = await convertOfficeToPDF(buffer, file.name);
      if (conversion.success && conversion.pdfBuffer) {
        pdfUrl = await uploadLearningMedia(
          new Uint8Array(conversion.pdfBuffer).buffer,
          file.name.replace(/\.(pptx?|pot|potx|docx?|dot|dotx)$/i, ".pdf"),
        );
        mediaType = isPpt ? "presentation" : "document";
      } else {
        // Zoals productie: mislukte conversie = upload weigeren (geen halve items).
        return { error: "conversion_failed" as const };
      }
    }

    const item = await prisma.learningMediaItem.create({
      data: {
        name: body.name?.trim() || file.name,
        type: mediaType,
        url,
        pdf_url: pdfUrl,
        file_size: file.size,
        mime_type: file.mimeType,
        tags: body.tags ?? [],
        company_id: isSuperAdmin(user) ? null : user.company_id,
        uploaded_by: user.id,
      },
    });
    return { data: item };
  },

  async update(
    user: AppUser,
    id: string,
    body: { name?: string; tags?: string[] },
  ) {
    const existing = await this.get(user, id);
    if ("error" in existing) return existing;
    const item = await prisma.learningMediaItem.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
      },
    });
    return { data: item };
  },

  async remove(user: AppUser, id: string) {
    const existing = await this.get(user, id);
    if ("error" in existing) return existing;
    await prisma.learningMediaItem.delete({ where: { id } });
    return { data: { deleted: true } };
  },
};
