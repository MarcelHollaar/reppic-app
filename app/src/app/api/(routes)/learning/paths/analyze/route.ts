import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { extractCompetenciesFromJobProfile } from "@/lib/services/learningPathAnalysisService";
import { extractTextFromDocument } from "@/lib/services/learningModuleGenerationService";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/learning/paths/analyze — stap 1 van de embedding-leerpadflow
 * (1-op-1 met productie /api/learning-paths/analyze-job-profile).
 * Accepteert JSON { job_profile_text } óf multipart met `document`
 * (pdf/doc/docx). Antwoord: functietitel + competenties + samenvatting +
 * volledige tekst (voor de semantische matching in stap 2).
 */
export async function POST(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  let text = "";
  let filename: string | null = null;
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const fileEntry = formData.get("document");
      if (!fileEntry || typeof fileEntry === "string") {
        return NextResponse.json({ message: "no_file" }, { status: 400 });
      }
      const ext = fileEntry.name.toLowerCase().split(".").pop() || "";
      if (!["pdf", "doc", "docx"].includes(ext)) {
        return NextResponse.json({ message: "invalid_type" }, { status: 400 });
      }
      filename = fileEntry.name;
      const extracted = await extractTextFromDocument(
        Buffer.from(await fileEntry.arrayBuffer()),
        fileEntry.name,
      );
      text = extracted.text;
    } else {
      const body = await req.json().catch(() => ({}));
      text = String(body.job_profile_text || "");
    }

    if (text.trim().length < 50) {
      return NextResponse.json({ message: "insufficient_text" }, { status: 400 });
    }

    const analysis = await extractCompetenciesFromJobProfile(text);
    return NextResponse.json({
      data: {
        fullText: text,
        preview: text.substring(0, 1000),
        jobTitle: analysis.jobTitle,
        competencies: analysis.competencies,
        summary: analysis.summary,
        filename,
      },
    });
  } catch (error) {
    console.error("[learning/paths/analyze] failed:", error);
    return NextResponse.json({ message: "analyze_failed" }, { status: 500 });
  }
}
