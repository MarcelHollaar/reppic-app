import { NextRequest } from "next/server";
import { CompanyController } from "@/app/api/controllers/companyController";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ companyId: string }> },
) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN, true);
  if (authCheck) return authCheck;

  const { companyId } = await context.params;
  return CompanyController.getCompanyDetailsById(req, companyId);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ companyId: string }> },
) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN, true);

  if (authCheck) return authCheck;

  const { companyId } = await context.params;
  // Extract NEXT_LOCALE cookie
  let langCode: string | undefined = undefined;

  const cookieHeader = req.headers.get("cookie");

  if (cookieHeader) {
    const match = cookieHeader.match(/NEXT_LOCALE=([^;]+)/);

    if (match) {
      langCode = decodeURIComponent(match[1]);
    }
  }

  return CompanyController.updateCompany(companyId, req, langCode);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ companyId: string }> },
) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  const { companyId } = await context.params;

  let langCode: string | undefined = undefined;
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/NEXT_LOCALE=([^;]+)/);
    if (match) {
      langCode = decodeURIComponent(match[1]);
    }
  }

  return CompanyController.deleteCompany(companyId, langCode);
}
