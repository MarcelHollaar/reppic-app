import { NextRequest } from "next/server";
import { authMiddleware } from "../../middleware/authMiddleware";
import { StatsController } from "../../controllers/statsController";
import { types } from "../../utils/type-constants";

export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type");
  switch (type) {
    case types.GET_PROGRESS_STATS:
      return StatsController.getProgressStats(req);
    default:
      return StatsController.getDashboardStats(req);
  }
}
