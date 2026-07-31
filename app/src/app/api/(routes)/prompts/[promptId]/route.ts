import { NextRequest } from "next/server";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { PromptController } from "../../../controllers/promptController";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ promptId: string }> }) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;
  const { promptId } = await params;
  return await PromptController.update(req, promptId);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ promptId: string }> }) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;
  const { promptId } = await params;
  return await PromptController.delete(req, promptId);
}
