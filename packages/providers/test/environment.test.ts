import assert from "node:assert/strict";
import test from "node:test";

import { withoutApiBillingEnv } from "../src/codex/environment.js";

test("removes API billing environment variables", () => {
  const sanitized = withoutApiBillingEnv({
    OPENAI_API_KEY: "sk-should-not-survive",
    CODEX_API_KEY: "codex-key-should-not-survive",
    CODEX_HOME: "/home/user/.codex",
    PATH: "/usr/bin",
  });

  assert.equal("OPENAI_API_KEY" in sanitized, false);
  assert.equal("CODEX_API_KEY" in sanitized, false);
  assert.equal(sanitized.CODEX_HOME, "/home/user/.codex");
  assert.equal(sanitized.PATH, "/usr/bin");
});

test("does not mutate the input environment object", () => {
  const original: NodeJS.ProcessEnv = { OPENAI_API_KEY: "sk-example" };
  withoutApiBillingEnv(original);
  assert.equal(original.OPENAI_API_KEY, "sk-example");
});
