import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { buildPhasePerformanceForUser } from "@/app/api/services/phasePerformanceService";
import { prisma } from "@/app/api/utils/prisma";

/**
 * Per-salesperson "Resultaten per gespreksfase" (PICA) data, derived from the
 * per-conversation analysis (the same source as the deep "Inzichten" layer) and
 * averaged over all of the user's conversations.
 *
 * Defaults to the logged-in user. Access scoping mirrors statsService:
 * - normal user  → only their own data,
 * - manager      → themselves or a member of their DIRECT team (manager_id),
 *                  never an arbitrary user (which could be in another company),
 * - superadmin   → any user.
 */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const requester = (req as any).user;
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  const role = requester?.role?.name;

  let targetUserId: string = requester.id;
  if (requestedUserId && requestedUserId !== requester.id) {
    if (role === "superadmin") {
      targetUserId = requestedUserId;
    } else if (role === "manager") {
      // Only allow viewing a direct report — prevents a manager from reading
      // any user's scores across company/tenant boundaries (IDOR).
      const teamMember = await prisma.user.findFirst({
        where: { id: requestedUserId, manager_id: requester.id },
        select: { id: true },
      });
      if (!teamMember) {
        return NextResponse.json(
          { error: "Unauthorized: Insufficient permissions" },
          { status: 403 },
        );
      }
      targetUserId = requestedUserId;
    } else {
      return NextResponse.json(
        { error: "Unauthorized: Insufficient permissions" },
        { status: 403 },
      );
    }
  }

  try {
    const data = await buildPhasePerformanceForUser(targetUserId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[phase-performance] Failed to build phase performance:", error);
    return NextResponse.json(
      { error: "Kon fase-prestaties niet laden" },
      { status: 500 },
    );
  }
}
