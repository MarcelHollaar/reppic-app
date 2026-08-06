import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";
import { LEARNING_ROLE, USER_ROLE } from "@/configs/constants";

const JWT_SECRET = process.env.JWT_SECRET;
// No insecure fallback: if JWT_SECRET is missing, auth fails closed (rather than
// trusting a guessable default). Make the cause unmissable in the logs.
if (!JWT_SECRET) {
  console.error(
    "[auth] FATAL: JWT_SECRET is not set. ALL authentication will fail. " +
      "Set JWT_SECRET in the environment, identical to the dashboard-backend.",
  );
}

export async function authMiddleware(
  req: NextRequest,
  requiredRole?: string,
  allowContactManager: boolean = false
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (!decoded || !decoded.id) {
      return NextResponse.json({ message: "Invalid token" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
        company: { select: { email: true } },
        company_id: true,
        learning_role: true,
        // Profieltaal: de server bepaalt hiermee zélf de weergavetaal van
        // leerinhoud (schermen kunnen het dus niet meer "vergeten").
        lang_code: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (requiredRole) {
      // superadmin is the highest role and may access any role-gated endpoint.
      const hasRequiredRole =
        user?.role?.name === requiredRole || user?.role?.name === "superadmin";
      const isContactManager =
        allowContactManager && user?.company?.email === user.email;

      if (!hasRequiredRole && !isContactManager) {
        return NextResponse.json(
          { message: "Unauthorized: Insufficient permissions" },
          { status: 403 }
        );
      }
    }

    (req as any).user = user;
    return null;
  } catch (error: any) {
    console.error("Auth Middleware Error:", error);
    return NextResponse.json(
      { message: "Authentication failed" },
      { status: 403 }
    );
  }
}

/**
 * Leer-as-variant van authMiddleware (LMS-integratie).
 *
 * Gate op de leer-rol (learning_role), onafhankelijk van de sales-rol.
 * - Platform-superadmin passeert altijd (impliciet leer-superadmin).
 * - requiredLearningRole = LEARNER: learner én learning_admin mogen door.
 * - requiredLearningRole = LEARNING_ADMIN: alleen learning_admin (binnen eigen
 *   bedrijf; tenant-checks gebeuren in de service-laag op company_id).
 * Gebruik dit voor alle /api/learning/* endpoints.
 */
export async function learningAuthMiddleware(
  req: NextRequest,
  requiredLearningRole: LEARNING_ROLE = LEARNING_ROLE.LEARNER
) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const user = (req as any).user;

  // Platform-superadmin is impliciet leer-superadmin.
  if (user?.role?.name === USER_ROLE.SUPER_ADMIN) {
    return null;
  }

  const learningRole: string = user?.learning_role || LEARNING_ROLE.NONE;

  const allowed =
    requiredLearningRole === LEARNING_ROLE.LEARNER
      ? learningRole === LEARNING_ROLE.LEARNER ||
        learningRole === LEARNING_ROLE.LEARNING_ADMIN
      : learningRole === LEARNING_ROLE.LEARNING_ADMIN;

  if (!allowed) {
    return NextResponse.json(
      { message: "Unauthorized: Insufficient learning permissions" },
      { status: 403 }
    );
  }

  return null;
}
