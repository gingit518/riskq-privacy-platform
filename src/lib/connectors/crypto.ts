// Encryption at rest for connector OAuth refresh tokens (schema.ts
// connector_connections.encryptedRefreshToken) — new infrastructure. Every
// other secret this app handles is either RiskQ's own env var (AUTH_SECRET,
// RESEND_API_KEY, BLOB_READ_WRITE_TOKEN — never stored in Postgres at all)
// or a customer's own password (bcrypt-hashed, one-way, never needs
// decrypting). A connector refresh token is different: it's a per-customer
// third-party secret this app must be able to read back in plaintext to use
// it, so hashing doesn't apply and a plain column isn't acceptable — hence
// real symmetric encryption, not a pattern reused from elsewhere in this
// codebase.
//
// AES-256-GCM via Node's built-in `crypto` — no new dependency. Key comes
// from CONNECTOR_ENCRYPTION_KEY (32 bytes, base64), generated the same way
// as AUTH_SECRET (see .env.example). Never logged; the decrypted value must
// never be sent to the client or included in any dsar_connector_events
// detail string — only used server-side, immediately before a token-refresh
// API call.

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const b64 = process.env.CONNECTOR_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      "CONNECTOR_ENCRYPTION_KEY is not set — see .env.example. Generate with: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("CONNECTOR_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

/** Returns "iv:authTag:ciphertext", each base64, colon-joined — one string
 * so it fits the existing single-column text() convention used everywhere
 * else in schema.ts rather than needing three new columns. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit nonce, standard for GCM
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, ctB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Malformed encrypted connector secret.");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
