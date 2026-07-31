import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { createRequire } from "module";
import QRCode from "qrcode";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      jwtUser?: {
        id: string;
        email: string;
        role: string;
        companyId: string | null;
      };
    }
  }
}
// Use createRequire to import CommonJS modules in an ESM context
const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const { TOTP, generateSecret } = require("otplib");
const connectPgSimple = require("connect-pg-simple");

// Fail hard at startup when secrets are missing. Running with a guessable
// fallback secret would let anyone forge valid tokens and sessions.
function requireEnvSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `${name} environment variable is required. Refusing to start without it — set it in .env (see .env.example).`,
    );
  }
  return value;
}

const JWT_SECRET = requireEnvSecret("JWT_SECRET");
const SESSION_SECRET = requireEnvSecret("SESSION_SECRET");

declare module "express-session" {
  interface SessionData {
    userId?: string;
    pendingUserId?: string;
    companyId?: string | null;
    userRole?: string;
  }
}

export function configureSession(app: any) {
  const PgStore = connectPgSimple(session);
  const sessionPool = new Pool({ connectionString: process.env.DATABASE_URL });

  app.use(
    session({
      store: new PgStore({
        pool: sessionPool,
        tableName: "session",
        createTableIfMissing: false,
      }),
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        // Secure cookies in production (requires trust proxy behind a reverse proxy)
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax", // CSRF hardening for the standalone session login
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days default
      },
    })
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Niet ingelogd" });
  }
  next();
}

export function requireJwtAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Niet ingelogd" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as any;
    req.jwtUser = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      companyId: decoded.company_id ?? null,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Ongeldige of verlopen token" });
  }
}

/**
 * Parses a Bearer token into req.jwtUser when present and valid, but never
 * rejects the request. For routes that accept either a session login (own
 * frontend) or a Reppic JWT (integration) and do their own auth check.
 */
export function parseJwtIfPresent(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET, { algorithms: ["HS256"] }) as any;
      req.jwtUser = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        companyId: decoded.company_id ?? null,
      };
    } catch {
      // Invalid token: leave req.jwtUser unset; the route decides what to do.
    }
  }
  next();
}

/**
 * JWT-role gate for mutating company-level resources (e.g. plan upload/delete).
 * Must run AFTER requireJwtAuth (relies on req.jwtUser). superadmin is the
 * highest role and always passes.
 */
export function requireManagerOrSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.jwtUser?.role;
  if (role !== "manager" && role !== "superadmin") {
    return res.status(403).json({ error: "Geen toegang" });
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Niet ingelogd" });
  }
  storage.getUser(req.session.userId).then((user) => {
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ error: "Geen toegang" });
    }
    next();
  });
}

export function safeUser(user: User) {
  const { password, twoFactorSecret, ...safe } = user;
  return safe;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTwoFactorSecret(email: string): { secret: string; otpauthUrl: string } {
  const secret = generateSecret();
  const totp = new TOTP();
  const otpauthUrl = totp.toURI(email, "Sales Dashboard", secret);
  return { secret, otpauthUrl };
}

export async function generateQRCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyTwoFactorToken(token: string, secret: string): boolean {
  try {
    const totp = new TOTP();
    return totp.verify({ token, secret });
  } catch {
    return false;
  }
}
