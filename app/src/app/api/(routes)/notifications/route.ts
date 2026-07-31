import { NextRequest } from "next/server";
import { authMiddleware } from "../../middleware/authMiddleware";
import { types } from "../../utils/type-constants";
import { NotificationController } from "../../controllers/notificationController";

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type");

  switch (type) {
    case types.GET_ALL_NOTIFICATIONS:
      return NotificationController.getNotifications(req);
    case types.GET_TEAM_NOTIFICATIONS:
      return NotificationController.getNotifications(req, true);
    default:
      return new Response("Invalid request type", { status: 400 });
  }
}