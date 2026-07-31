import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { RecallAIService } from "@/app/api/services/recallAIService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  try {
    const authenticatedUser = (req as any).user;
    if (!authenticatedUser?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = authenticatedUser.id;

    console.log(`[RecallCalendarAuth] Generating token for user: ${userId}`);

    const token = await RecallAIService.getCalendarAuthToken(userId);

    return NextResponse.json({
      success: true,
      token,
    });
  } catch (error: any) {
    console.error("[RecallCalendarAuth] Error:", error.message);
    return NextResponse.json(
      { message: error.message || "Failed to generate calendar auth token" },
      { status: 500 }
    );
  }
}
