import assert from "node:assert/strict";
import test from "node:test";

import { withoutApiBillingEnv } from "../src/claude-code/environment.js";

test("removes API billing environment variables", () => {
  const sanitized = withoutApiBillingEnv({
    ANTHROPIC_API_KEY: "sk-should-not-survive",
    ANTHROPIC_AUTH_TOKEN: "bearer-should-not-survive",
    CLAUDE_CODE_OAUTH_TOKEN: "ci-token-should-survive",
    PATH: "/usr/bin",
  });

  assert.equal("ANTHROPIC_API_KEY" in sanitized, false);
  assert.equal("ANTHROPIC_AUTH_TOKEN" in sanitized, false);
  assert.equal(sanitized.CLAUDE_CODE_OAUTH_TOKEN, "ci-token-should-survive");
  assert.equal(sanitized.PATH, "/usr/bin");
});

test("does not mutate the input environment object", () => {
  const original: NodeJS.ProcessEnv = { ANTHROPIC_API_KEY: "sk-example" };
  withoutApiBillingEnv(original);
  assert.equal(original.ANTHROPIC_API_KEY, "sk-example");
});
