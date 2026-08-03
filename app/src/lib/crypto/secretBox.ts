import crypto from "crypto";

// AES-256-GCM secret-box voor gevoelige waarden die in de database moeten
// staan (bijv. HubSpot OAuth-tokens). Sleutel komt uit ENCRYPTION_KEY
// (32 bytes, base64 — genereer met `openssl rand -base64 32`).
// Formaat: "v1:<iv_b64>:<tag_b64>:<ct_b64>" zodat het schema later kan
// evolueren zonder bestaande rijen te breken.

const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes (base64)");
  }
  return key;
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(encoded: string): string {
  const [version, ivB64, tagB64, ctB64] = encoded.split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Invalid encrypted secret format");
  }
  const key = getKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// HMAC-helpers voor de OAuth-state (geen encryptie nodig, wel integriteit).
export function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getKey()).update(payload).digest("base64url");
}

export function verifyPayloadSignature(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
