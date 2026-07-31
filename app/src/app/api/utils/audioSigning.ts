import crypto from "crypto";

/**
 * Short-lived signed access for private recordings. The audio-stream endpoint
 * does the real authorization (owner / manager / superadmin) and then hands out
 * a signed, expiring URL to the byte-serving proxy. A media element can load
 * that URL directly (it can't send an Authorization header), while the link is
 * unforgeable (HMAC) and short-lived — replacing the previous permanent, public
 * FTP URL that bypassed authorization entirely.
 */

const SECRET = process.env.JWT_SECRET || "";
const TTL_MS = 10 * 60_000; // 10 minutes

function sign(conversationId: string, userId: string, exp: number): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${conversationId}.${userId}.${exp}`)
    .digest("hex");
}

export function signAudioAccess(
  conversationId: string,
  userId: string,
): { exp: number; sig: string } {
  const exp = Date.now() + TTL_MS;
  return { exp, sig: sign(conversationId, userId, exp) };
}

export function verifyAudioAccess(
  conversationId: string,
  userId: string,
  exp: number,
  sig: string,
): boolean {
  if (!SECRET) return false;
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = sign(conversationId, userId, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
