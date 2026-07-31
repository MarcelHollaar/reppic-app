import {
  login,
  register,
  verifyEmail,
  forgotPassword,
  resetPassword,
  verifyOtp,
  resendPasswordOtp,
  resendEmailVerificationOtp,
  createPassword,
  verifyLoginOtp,
  resendLoginOtp,
} from "../../controllers/authController";
import { types } from "../../utils/type-constants";
import { rateLimit, getClientIp } from "../../utils/rateLimiter";

// Per-action brute-force limits (attempts per window, keyed by IP+email).
// Verify/login/reset are tight because they gate authentication; the numeric
// OTP keyspace is bounded, so unlimited guessing must be prevented.
const AUTH_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  [types.LOGIN]: { limit: 10, windowMs: 10 * 60_000 },
  [types.VERIFY_LOGIN_OTP]: { limit: 8, windowMs: 10 * 60_000 },
  [types.VERIFY_OTP]: { limit: 8, windowMs: 10 * 60_000 },
  [types.VERIFY_EMAIL]: { limit: 8, windowMs: 10 * 60_000 },
  [types.FORGOT_PASSWORD]: { limit: 5, windowMs: 15 * 60_000 },
  [types.RESET_PASSWORD]: { limit: 8, windowMs: 10 * 60_000 },
  [types.CREATE_PASSWORD]: { limit: 8, windowMs: 10 * 60_000 },
  [types.REGISTER]: { limit: 5, windowMs: 15 * 60_000 },
  [types.RESEND_LOGIN_OTP]: { limit: 5, windowMs: 15 * 60_000 },
  [types.RESEND_PASSWORD_CODE]: { limit: 5, windowMs: 15 * 60_000 },
  [types.RESEND_EMAIL_VERIFICATION_CODE]: { limit: 5, windowMs: 15 * 60_000 },
};
const DEFAULT_LIMIT = { limit: 20, windowMs: 10 * 60_000 };

function tooMany(retryAfterSec: number) {
  return new Response(
    JSON.stringify({ message: "Too many attempts. Please try again later." }),
    { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSec) } },
  );
}

export async function POST(req: Request) {
  const { type, userData } = await req.json();

  // ── Rate limiting (brute-force protection) ──
  const ip = getClientIp(req);
  const email = String(userData?.email || "").toLowerCase();
  // A coarse per-IP cap across all auth actions (blunts enumeration floods)…
  const ipWide = rateLimit(`auth:ip:${ip}`, 60, 10 * 60_000);
  if (!ipWide.allowed) return tooMany(ipWide.retryAfterSec);
  // …plus a tight per-action, per-identity cap.
  const cfg = (type && AUTH_LIMITS[type]) || DEFAULT_LIMIT;
  const perAction = rateLimit(`auth:${type}:${ip}:${email}`, cfg.limit, cfg.windowMs);
  if (!perAction.allowed) return tooMany(perAction.retryAfterSec);

  // Extract NEXT_LOCALE cookie
  let langCode: string | undefined = undefined;

  const cookieHeader = req.headers.get("cookie");

  if (cookieHeader) {
    const match = cookieHeader.match(/NEXT_LOCALE=([^;]+)/);

    if (match) {
      langCode = decodeURIComponent(match[1]);
    }
  }

  switch (type) {
    case types.LOGIN:
      return await login(userData, langCode);
    case types.VERIFY_LOGIN_OTP:
      return await verifyLoginOtp(userData, langCode);
    case types.RESEND_LOGIN_OTP:
      return await resendLoginOtp(userData, langCode);
    case types.REGISTER:
      return await register(userData);
    case types.VERIFY_EMAIL:
      return await verifyEmail(userData, langCode);
    case types.FORGOT_PASSWORD:
      return await forgotPassword(userData, langCode);
    case types.VERIFY_OTP:
      return await verifyOtp(userData, langCode);
    case types.RESET_PASSWORD:
      return await resetPassword(userData, langCode);
    case types.CREATE_PASSWORD:
      return await createPassword(userData, langCode);
    case types.RESEND_PASSWORD_CODE:
      return await resendPasswordOtp(userData, langCode);
    case types.RESEND_EMAIL_VERIFICATION_CODE:
      return await resendEmailVerificationOtp(userData, langCode);
    default:
      return new Response("Invalid request type", { status: 400 });
  }
}
