import { NextRequest, NextResponse } from "next/server";
import { PromptService } from "../services/promptService";
import { saveFileToFtp, deleteFile } from "../utils/fileStorage";

const SUPPORTED_LANG_CODES = ["en", "nl", "de", "fr", "it", "es"];
const KNOWLEDGE_FOLDER =
  process.env.EXCEL_DATA_FTP_FOLDER || "salescoach-excel-data";

function sanitizeFileName(input: string, fallback = "knowledge") {
  const cleaned = input.split(".").slice(0, -1).join(".") || input;
  return (
    cleaned
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

function getExtension(input: string) {
  const idx = input.lastIndexOf(".");
  return idx >= 0 ? input.slice(idx).toLowerCase() : "";
}

function parseStoredExcelMeta(raw?: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.filePath) return parsed;
  } catch {}

  return null;
}

export class PromptController {
  static async list(req: NextRequest) {
    try {
      const user = (req as any).user;

      if (!user)
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );

      const result = await PromptService.list(req);

      return NextResponse.json(
        { message: "Prompts fetched", data: result },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error while listing prompts", error);

      return NextResponse.json(
        { message: "Internal Server Error" },
        { status: 500 }
      );
    }
  }

  static async getById(req: NextRequest, id: string) {
    try {
      const user = (req as any).user;

      if (!user)
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );

      const prompt = await PromptService.getById(id);

      return NextResponse.json(
        { message: "Prompt fetched", data: prompt },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error while getting prompt", error);

      return NextResponse.json(
        { message: "Internal Server Error" },
        { status: 500 }
      );
    }
  }

  static async upsertMany(req: NextRequest) {
    try {
      const user = (req as any).user;

      if (!user)
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );

      const contentType = req.headers.get("content-type") || "";

      if (contentType.includes("multipart/form-data")) {
        return await PromptController.handleExcelUpload(req);
      }

      let body: any = null;

      try {
        body = await req.json();
      } catch {}

      const prompts = body?.prompts;

      if (
        !body ||
        typeof body !== "object" ||
        !prompts ||
        typeof prompts !== "object"
      )
        return NextResponse.json(
          { message: "Invalid payload" },
          { status: 400 }
        );

      const data = await PromptService.upsertMany({ promptsByLang: prompts });

      return NextResponse.json(
        { message: "Prompts saved", data },
        { status: 200 }
      );
    } catch (error) {
      console.error("Error while upserting prompts", error);

      return NextResponse.json(
        { message: "Internal Server Error" },
        { status: 500 }
      );
    }
  }

  static async update(req: NextRequest, id: string) {
    try {
      const user = (req as any).user;

      if (!user)
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );

      const data = await req.json();

      await PromptService.update(id, data);

      return NextResponse.json({ message: "Prompt updated" }, { status: 200 });
    } catch (error) {
      console.error("Error while updating prompt", error);

      return NextResponse.json(
        { message: "Internal Server Error" },
        { status: 500 }
      );
    }
  }

  static async delete(req: NextRequest, id: string) {
    try {
      const user = (req as any).user;

      if (!user)
        return NextResponse.json(
          { message: "Unauthorized User." },
          { status: 401 }
        );

      await PromptService.delete(id);

      return NextResponse.json({ message: "Prompt deleted" }, { status: 200 });
    } catch (error) {
      console.error("Error while deleting prompt", error);

      return NextResponse.json(
        { message: "Internal Server Error" },
        { status: 500 }
      );
    }
  }

  private static async handleExcelUpload(req: NextRequest) {
    try {
      const formData = await req.formData();
      const uploads = SUPPORTED_LANG_CODES.map((lang) => {
        const file = formData.get(lang);

        return file instanceof File && file.size ? { lang, file } : null;
      }).filter(Boolean) as Array<{ lang: string; file: File }>;

      if (!uploads.length) {
        return NextResponse.json(
          { message: "No Excel file provided" },
          { status: 400 }
        );
      }

      const upserts: Record<string, string> = {};
      const responsePayload: Array<Record<string, any>> = [];
      const pendingDeletes: string[] = [];
      const uploadedPaths: string[] = [];
      const allowedExtensions = [".xlsx", ".xls"];

      try {
        for (const { lang, file } of uploads) {
          const originalName = file.name || `${lang}.xlsx`;
          const extension = getExtension(originalName) || ".xlsx";

          if (!allowedExtensions.includes(extension)) {
            throw new Error(
              `Invalid file type for ${lang}. Only Excel files are allowed.`
            );
          }

          const fileBuffer = await file.arrayBuffer();
          const baseName = sanitizeFileName(originalName, `${lang}-knowledge`);
          const fileName = `${lang}-${Date.now()}-${baseName}${extension}`;
          const relativeFolder = `${KNOWLEDGE_FOLDER}/${lang}`;
          const relativePath = await saveFileToFtp(
            fileBuffer,
            fileName,
            relativeFolder
          );

          uploadedPaths.push(relativePath);

          const storedPayload = {
            type: "excel",
            fileName: originalName,
            filePath: relativePath,
            fileSize: file.size,
            uploadedAt: new Date().toISOString(),
          };

          upserts[lang] = JSON.stringify(storedPayload);
          responsePayload.push({ lang, ...storedPayload });

          const existing = await PromptService.getLatestForLang(lang);
          const existingMeta = parseStoredExcelMeta(existing?.prompt);

          if (
            existingMeta?.filePath &&
            existingMeta.filePath !== relativePath
          ) {
            pendingDeletes.push(existingMeta.filePath);
          }
        }

        await PromptService.upsertMany({ promptsByLang: upserts });
        await Promise.all(
          pendingDeletes.map((path) => deleteFile(path).catch(() => {}))
        );

        return NextResponse.json(
          { message: "Excel files updated", data: responsePayload },
          { status: 200 }
        );
      } catch (error) {
        await Promise.all(
          uploadedPaths.map((path) => deleteFile(path).catch(() => {}))
        );

        console.error("Error while handling Excel file uploads", error);

        const status =
          error instanceof Error && /Invalid file type/.test(error.message)
            ? 400
            : 500;

        return NextResponse.json(
          {
            message:
              (error as Error)?.message || "Failed to upload Excel files",
          },
          { status }
        );
      }
    } catch (error) {
      console.error("Error while processing Excel file uploads", error);

      return NextResponse.json(
        { message: "Internal Server Error" },
        { status: 500 }
      );
    }
  }
}
