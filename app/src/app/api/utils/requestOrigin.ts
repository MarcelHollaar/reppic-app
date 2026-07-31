import type { NextRequest } from "next/server";

/**
 * The public origin this request actually arrived on (e.g. https://app.reppic.ai).
 *
 * Why this exists
 * ---------------
 * Callback URLs handed to an external service ("call me back here") must point
 * at the environment that is running *right now*. Deriving them from a
 * configured `APP_URL` makes every new environment (test, staging, production,
 * a tunnel during local testing) a manual step that fails silently when it is
 * wrong: the external service calls a dead or foreign host, no callback ever
 * arrives, and nothing is logged because from our side nothing happened.
 *
 * The request itself already carries the answer, so use that instead of config.
 * `APP_URL` stays in use for links we generate outside a request (e-mails).
 *
 * Proxy handling: behind a load balancer / reverse proxy the original host and
 * scheme live in the `x-forwarded-*` headers; the first entry of a
 * comma-separated list is the client-facing one.
 */
export function getRequestOrigin(req: NextRequest): string | null {
  const first = (value: string | null) =>
    value?.split(",")[0]?.trim() || null;

  const host = first(req.headers.get("x-forwarded-host")) ?? first(req.headers.get("host"));

  if (!host) return null;

  const forwardedProto = first(req.headers.get("x-forwarded-proto"));
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  const proto = forwardedProto ?? (isLocal ? "http" : "https");

  return `${proto}://${host}`;
}

/**
 * Base URL for callbacks: the live request origin, falling back to APP_URL when
 * the origin cannot be determined (non-request contexts).
 *
 * A mismatch between the two is not an error — a tunnel or an extra domain is
 * legitimate — but it is worth surfacing, because a stale `APP_URL` is exactly
 * what silently breaks e-mail links while callbacks keep working.
 */
export function getCallbackBaseUrl(req: NextRequest): string | null {
  const origin = getRequestOrigin(req);
  const configured = process.env.APP_URL?.replace(/\/$/, "") || null;

  if (!origin) return configured;

  if (configured && configured !== origin) {
    console.warn(
      `[config] APP_URL (${configured}) wijkt af van de origin waarop deze request binnenkwam (${origin}). ` +
        `Callbacks gebruiken de live origin; e-mail-links gebruiken APP_URL — controleer of APP_URL nog klopt.`,
    );
  }

  return origin;
}
