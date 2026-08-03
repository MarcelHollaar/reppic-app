import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../middleware/authMiddleware";
import { learningService } from "@/lib/services/learningService";
import { LEARNING_ROLE } from "@/configs/constants";

/**
 * GET /api/learning/admin/employees — medewerkers + leerstatistieken.
 * learning_admin: eigen bedrijf; superadmin: ?company_id=… mogelijk.
 */
export async function GET(req: NextRequest) {
  const authCheck = await learningAuthMiddleware(
    req,
    LEARNING_ROLE.LEARNING_ADMIN,
  );
  if (authCheck) return authCheck;

  const user = (req as any).user;
  const companyId = req.nextUrl.searchParams.get("company_id") || undefined;
  const data = await learningService.getCompanyEmployees(user, companyId);
  if (!data) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ data });
}
