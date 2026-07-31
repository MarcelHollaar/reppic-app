import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { RecallAIService } from "@/app/api/services/recallAIService";
import { prisma } from "@/app/api/utils/prisma";

export const dynamic = "force-dynamic";

/**
 * Desktop Recording SDK — upload token.
 *
 * Called by the Reppic desktop shell when the Recall SDK detects a meeting.
 * Creates a Desktop SDK upload at Recall.ai and stores an upload_id -> user_id
 * mapping, so the sdk_upload.complete webhook can attribute the recording to
 * the user deterministically (no organizer-email matching needed).
 *
 * Attribution:
 *  - Normal/production: the caller must be authenticated (authMiddleware) and
 *    the recording is attributed to that logged-in user.
 *  - Local test only: if DESKTOP_TEST_USER_EMAIL is set in the environment AND
 *    the request carries the header `x-desktop-test: 1`, the recording is
 *    attributed to that fixed user without a login. This lets the desktop shell
 *    record without the app-login flow during local testing. In production this
 *    env var is unset, so the bypass is inert.
 */
export async function POST(req: NextRequest) {
  const testEmail = process.env.DESKTOP_TEST_USER_EMAIL?.trim();
  // Structurally inert in production: even if DESKTOP_TEST_USER_EMAIL is ever
  // set in a prod/shared environment by mistake, the bypass can never activate.
  const isTestBypass =
    process.env.NODE_ENV !== "production" &&
    !!testEmail &&
    req.headers.get("x-desktop-test") === "1";

  let userId: string;

  if (isTestBypass) {
    const testUser = await prisma.user.findUnique({
      where: { email: testEmail },
      select: { id: true },
    });
    if (!testUser) {
      return NextResponse.json(
        { message: "DESKTOP_TEST_USER_EMAIL user not found" },
        { status: 400 }
      );
    }
    userId = testUser.id;
    console.warn(
      `[RecallAI] desktop-upload-token: LOCAL TEST BYPASS active (user ${testEmail})`
    );
  } else {
    const authCheck = await authMiddleware(req);
    if (authCheck) return authCheck;
    userId = (req as any).user.id;
  }

  try {
    const upload = await RecallAIService.createDesktopSdkUpload(userId);

    await prisma.desktopSdkUpload.create({
      data: {
        upload_id: upload.id,
        user_id: userId,
      },
    });

    return NextResponse.json({ uploadToken: upload.upload_token });
  } catch (error) {
    console.error("[RecallAI] desktop-upload-token failed:", error);
    // Generic message on purpose — no upstream details to the client.
    return NextResponse.json(
      { message: "Could not create upload token" },
      { status: 500 }
    );
  }
}
