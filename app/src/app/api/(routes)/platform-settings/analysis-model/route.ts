import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { platformSettingsService } from "../../../services/platformSettingsService";

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);

  if (authCheck) return authCheck;

  try {
    const settings = await platformSettingsService.getAnalysisModelSettings();

    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("[platform-settings/analysis-model] GET failed:", error);

    return NextResponse.json(
      { message: "Failed to load analysis model settings" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);

  if (authCheck) return authCheck;

  try {
    const body = await req.json();
    const routeId = typeof body?.routeId === "string" ? body.routeId : "";

    if (!routeId.trim()) {
      return NextResponse.json(
        { message: "Model route is required" },
        { status: 400 },
      );
    }

    const savedRoute =
      await platformSettingsService.setAnalysisLiteLLMRoute(routeId);

    const settings = await platformSettingsService.getAnalysisModelSettings();

    return NextResponse.json({
      data: {
        currentRouteId: savedRoute.routeId,
        currentModel: settings.currentModel,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save analysis model";

    console.error("[platform-settings/analysis-model] PUT failed:", error);

    if (
      message.includes("not available") ||
      message.includes("Could not load models")
    ) {
      return NextResponse.json({ message }, { status: 400 });
    }

    return NextResponse.json({ message }, { status: 500 });
  }
}
