import { NextRequest } from "next/server";
import { authMiddleware } from "../../middleware/authMiddleware";
import { USER_ROLE } from "@/configs/constants";
import { types } from "../../utils/type-constants";
import { PromptController } from "../../controllers/promptController";

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  switch (type) {
    case types.GET_PROMPTS:
      return await PromptController.list(req);
    case types.GET_PROMPT:
      if (!id) return new Response("Prompt ID is required", { status: 400 });
      return await PromptController.getById(req, id);
    default:
      return new Response("Invalid request type", { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;
  return await PromptController.upsertMany(req);
}

