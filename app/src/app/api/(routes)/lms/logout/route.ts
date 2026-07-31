import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { logoutUserFromLMS } from "@/lib/services/lms-sync";

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/lms/logout
 *
 * Invalidates the current user's LMS sessions.
 * Called during logout from the main Reppic platform.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

    if (!decoded?.id || !decoded?.email) {
      return NextResponse.json({ message: "Invalid token" }, { status: 403 });
    }

    const result = await logoutUserFromLMS(decoded.id, decoded.email);

    return NextResponse.json({
      success: result.success,
      message: result.message || "LMS logout completed",
    });
  } catch (error) {
    console.error("[LMS-LOGOUT-ROUTE] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to logout from LMS" },
      { status: 500 },
    );
  }
}
