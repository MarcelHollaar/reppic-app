import { NextRequest } from "next/server";
import { CompanyController } from "@/app/api/controllers/companyController";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";

export async function GET(req: NextRequest, context: { params: Promise<{ companyId: string }> }) {
    const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN, true);
    if (authCheck) return authCheck;
  
    const { companyId } = await context.params;
    return CompanyController.getCompanyUsers(companyId, req);
}
