import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { prisma } from "../../../utils/prisma";
import { syncUserToLMS } from "@/lib/services/lms-sync";

/**
 * POST /api/lms/sync-all-users
 * 
 * Admin-only endpoint to sync all users from the main app to the LMS.
 * Requires SUPER_ADMIN role.
 */
export async function POST(req: NextRequest) {
  // Verify admin access
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  try {
    // Fetch all users with their companies
    const users = await prisma.user.findMany({
      include: { company: true },
    });

    console.log(`[LMS-BULK-SYNC] Starting bulk sync for ${users.length} users`);

    const results = {
      total: users.length,
      synced: 0,
      skipped: 0,
      failed: 0,
      errors: [] as { email: string; error: string }[],
    };

    // Sync each user
    for (const user of users) {
      try {
        const result = await syncUserToLMS(
          {
            id: user.id,
            name: user.name,
            email: user.email,
            password: user.password,
            phone_number: user.phone_number,
            lang_code: user.lang_code,
          },
          user.company ? {
            id: user.company.id,
            name: user.company.title, // Map title to name for LMS
            email: user.company.email,
          } : null
        );

        if (result.success) {
          if (result.message?.includes("skipped") || result.message?.includes("not configured")) {
            results.skipped++;
          } else {
            results.synced++;
          }
        } else {
          results.failed++;
          results.errors.push({
            email: user.email,
            error: result.error || "Unknown error",
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: user.email,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log(
      `[LMS-BULK-SYNC] Completed: ${results.synced} synced, ${results.skipped} skipped, ${results.failed} failed`
    );

    return NextResponse.json({
      success: true,
      message: `Bulk sync completed: ${results.synced} synced, ${results.skipped} skipped, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error("[LMS-BULK-SYNC] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync users",
      },
      { status: 500 }
    );
  }
}
