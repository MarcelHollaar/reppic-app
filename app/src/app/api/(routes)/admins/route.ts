import { NextRequest } from "next/server";
import { authMiddleware } from "../../middleware/authMiddleware";
import { TeamMemberController } from "../../controllers/teamMemberController";
import { USER_ROLE } from "@/configs/constants";

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  return TeamMemberController.getAdminUsers(req);
}