import { NextRequest } from "next/server";
import { CompanyController } from "../../controllers/companyController";
import { authMiddleware } from "../../middleware/authMiddleware";
import { types } from "../../utils/type-constants";
import { USER_ROLE } from "@/configs/constants";

export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;
  // Extract NEXT_LOCALE cookie
  let langCode: string | undefined = undefined;
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
      const match = cookieHeader.match(/NEXT_LOCALE=([^;]+)/);
      if (match) {
          langCode = decodeURIComponent(match[1]);
      }
  }
  return CompanyController.createCompanyWithUsers(req, langCode);
}

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  return CompanyController.getCompanies(req);
}