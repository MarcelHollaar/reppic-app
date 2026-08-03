import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { PLATFORM_SETTING_KEYS, USER_ROLE } from "@/configs/constants";
import {
  getLmsChatModelSettings,
  setLmsChatRoute,
} from "../../../services/learningModelSettingsService";

const KEY = PLATFORM_SETTING_KEYS.LMS_TRANSLATION_LITELLM_MODEL;

/** GET — instellingen voor de module-vertaal-modelpicker (superadmin). */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;
  try {
    const settings = await getLmsChatModelSettings(KEY);
    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error(
      "[platform-settings/lms-translation-model] GET failed:",
      error,
    );
    return NextResponse.json(
      { message: "Failed to load model settings" },
      { status: 500 },
    );
  }
}

/** PUT — modelkeuze opslaan. Body: { routeId }. */
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
    const savedRoute = await setLmsChatRoute(KEY, routeId);
    const settings = await getLmsChatModelSettings(KEY);
    return NextResponse.json({
      data: {
        currentRouteId: savedRoute.routeId,
        currentModel: settings.currentModel,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save model";
    console.error(
      "[platform-settings/lms-translation-model] PUT failed:",
      error,
    );
    const status =
      message.includes("not available") || message.includes("Could not load")
        ? 400
        : 500;
    return NextResponse.json({ message }, { status });
  }
}
