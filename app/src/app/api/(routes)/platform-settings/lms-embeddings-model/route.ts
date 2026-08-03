import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import {
  getLmsEmbeddingsSettings,
  setLmsEmbeddingsModel,
} from "../../../services/learningModelSettingsService";
import { reindexAllLibraryDocuments } from "@/lib/services/learningEmbeddingsService";

/** GET — instellingen voor de bibliotheek-embeddings-picker (superadmin). */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;
  try {
    const settings = await getLmsEmbeddingsSettings();
    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error(
      "[platform-settings/lms-embeddings-model] GET failed:",
      error,
    );
    return NextResponse.json(
      { message: "Failed to load embeddings settings" },
      { status: 500 },
    );
  }
}

/**
 * PUT — embeddings-model opslaan. Body: { model } (lege string = uitzetten,
 * terugvallen op env). Bestaande documenten worden daarna op de achtergrond
 * geherindexeerd met het nieuwe model; tot die tijd zoekt semantisch zoeken
 * alleen in al-geherindexeerde documenten (model-mismatch wordt genegeerd).
 */
export async function PUT(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;
  try {
    const body = await req.json();
    const model = typeof body?.model === "string" ? body.model : "";
    await setLmsEmbeddingsModel(model);

    // Her-indexering op de achtergrond (fire-and-forget); faalt stil per doc.
    reindexAllLibraryDocuments()
      .then((stats) =>
        console.log(
          `[lms-embeddings] herindexering na modelwissel: ${stats.reindexed} opnieuw, ${stats.skipped} overgeslagen`,
        ),
      )
      .catch((err) =>
        console.error("[lms-embeddings] herindexering mislukt:", err),
      );

    const settings = await getLmsEmbeddingsSettings();
    return NextResponse.json({ data: settings });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save embeddings model";
    console.error(
      "[platform-settings/lms-embeddings-model] PUT failed:",
      error,
    );
    return NextResponse.json({ message }, { status: 500 });
  }
}
