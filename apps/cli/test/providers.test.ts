import assert from "node:assert/strict";
import test from "node:test";

import { UnknownProviderError, selectProvider } from "@primetime/providers";

test("selects the Codex provider", () => {
  const provider = selectProvider("codex");

  assert.equal(provider.id, "codex");
  assert.equal(provider.name, "Codex");
});

test("selects the Claude Code provider", () => {
  const provider = selectProvider("claude-code");

  assert.equal(provider.id, "claude-code");
  assert.equal(provider.name, "Claude Code");
});

test("provider selection is case insensitive", () => {
  assert.equal(selectProvider("CODEX").id, "codex");
  assert.equal(selectProvider("CLAUDE-CODE").id, "claude-code");
});

test("rejects an unknown provider", () => {
  assert.throws(() => selectProvider("unknown"), UnknownProviderError);
});

test("does not echo an unknown provider value in errors", () => {
  const sensitiveLookingValue = "secret-looking-provider-value";

  assert.throws(
    () => selectProvider(sensitiveLookingValue),
    (error: unknown) => {
      assert.ok(error instanceof UnknownProviderError);
      assert.equal(error.message.includes(sensitiveLookingValue), false);
      return true;
    },
  );
});
