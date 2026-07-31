import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";

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
