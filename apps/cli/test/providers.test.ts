import assert from "node:assert/strict";
import test from "node:test";

import {
  ProviderOperationNotImplementedError,
  UnknownProviderError,
  selectProvider,
} from "@primetime/providers";

test("selects the Codex provider", () => {
  const provider = selectProvider("codex");

  assert.equal(provider.id, "codex");
  assert.equal(provider.name, "Codex");
});

test("provider selection is case insensitive", () => {
  assert.equal(selectProvider("CODEX").id, "codex");
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

test("Codex setup reports that it is not implemented", async () => {
  await assert.rejects(
    selectProvider("codex").setup(),
    ProviderOperationNotImplementedError,
  );
});
