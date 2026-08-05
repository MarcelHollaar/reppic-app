import { NextRequest, NextResponse } from "next/server";
import { learningAuthMiddleware } from "../../../../../middleware/authMiddleware";
import { LEARNING_ROLE } from "@/configs/constants";
import { prisma } from "@/app/api/utils/prisma";

type Params = { params: Promise<{ tourId: string }> };

/**
 * GET /api/learning/help/tours/[tourId] — tourvoortgang van de gebruiker
 * (port van productie /api/help/tours/:tourId; in productie zonder UI).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const { tourId } = await params;
  const progress = await prisma.userTourProgress.findUnique({
    where: { user_tour_unique: { user_id: user.id, tour_id: tourId } },
  });
  return NextResponse.json({
    data: progress || { completed: false, current_step: 0 },
  });
}

/**
 * POST — voortgang bijwerken. Body: { current_step?, completed? }.
 * completed=true zet ook completed_at (port van /progress + /complete).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const authCheck = await learningAuthMiddleware(req, LEARNING_ROLE.LEARNER);
  if (authCheck) return authCheck;
  const user = (req as any).user;
  const { tourId } = await params;
  const body = await req.json().catch(() => ({}));
  const completed = body.completed === true;
  const data = {
    ...(typeof body.current_step === "number"
      ? { current_step: body.current_step }
      : {}),
    ...(completed ? { completed: true, completed_at: new Date() } : {}),
  };
  const progress = await prisma.userTourProgress.upsert({
    where: { user_tour_unique: { user_id: user.id, tour_id: tourId } },
    create: { user_id: user.id, tour_id: tourId, ...data },
    update: data,
  });
  return NextResponse.json({ data: progress });
}
