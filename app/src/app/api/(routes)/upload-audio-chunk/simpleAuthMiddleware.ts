import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Simple auth middleware that only verifies JWT token and returns userId
 * No database calls, no role checking - just token verification
 */
export function getUserId(req: NextRequest): string {
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    
    if (!decoded || !decoded.id) {
      throw new Error("Invalid token: No user ID found");
    }

    return decoded.id;
  } catch (error) {
    throw new Error("Authentication failed: Invalid or expired token");
  }
}

