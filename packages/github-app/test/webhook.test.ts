import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import { verifyWebhookSignature } from "../src/webhook.js";

const SECRET = "webhook-secret-fixture";
const PAYLOAD = JSON.stringify({ action: "created", installation: { id: 1 } });

function signaturePrefixedFor(payload: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

test("accepts a correctly signed payload", () => {
  const signature = signaturePrefixedFor(PAYLOAD, SECRET);
  assert.equal(verifyWebhookSignature(PAYLOAD, signature, SECRET), true);
});

test("rejects a tampered payload", () => {
  const signature = signaturePrefixedFor(PAYLOAD, SECRET);
  const tamperedPayload = JSON.stringify({ action: "deleted", installation: { id: 1 } });
  assert.equal(verifyWebhookSignature(tamperedPayload, signature, SECRET), false);
});

test("rejects a signature computed with the wrong secret", () => {
  const signature = signaturePrefixedFor(PAYLOAD, "wrong-secret");
  assert.equal(verifyWebhookSignature(PAYLOAD, signature, SECRET), false);
});

test("rejects a missing or malformed signature header", () => {
  assert.equal(verifyWebhookSignature(PAYLOAD, null, SECRET), false);
  assert.equal(verifyWebhookSignature(PAYLOAD, undefined, SECRET), false);
  assert.equal(verifyWebhookSignature(PAYLOAD, "not-a-signature", SECRET), false);
});
