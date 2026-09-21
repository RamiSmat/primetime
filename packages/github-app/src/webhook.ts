import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

/**
 * Verifies a GitHub App webhook delivery's `X-Hub-Signature-256` header
 * against the webhook secret, using a timing-safe comparison so response
 * latency can't be used to guess the correct signature byte by byte. Takes
 * the raw request body exactly as received — signature verification must
 * happen before the payload is parsed as JSON, since re-serializing it
 * could change the bytes being signed.
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const provided = Buffer.from(signatureHeader.slice(SIGNATURE_PREFIX.length), "hex");
  const expected = createHmac("sha256", secret).update(payload).digest();

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
