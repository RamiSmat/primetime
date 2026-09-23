import { PrimeTimeError } from "@primetime/shared";

import type { ProviderAdapter } from "./adapter.js";
import { claudeCodeProvider } from "./claude-code/index.js";
import { codexProvider } from "./codex/index.js";

const providers: ReadonlyMap<string, ProviderAdapter> = new Map([
  [codexProvider.id, codexProvider],
  [claudeCodeProvider.id, claudeCodeProvider],
]);

export class UnknownProviderError extends PrimeTimeError {
  public constructor() {
    super(
      "invalid_configuration",
      `Unknown provider. Supported providers: ${[
        ...providers.keys(),
      ].join(", ")}.`,
    );
    this.name = "UnknownProviderError";
  }
}

export function selectProvider(providerId: string): ProviderAdapter {
  const normalizedProviderId = providerId.trim().toLowerCase();
  const provider = providers.get(normalizedProviderId);

  if (provider === undefined) {
    throw new UnknownProviderError();
  }

  return provider;
}
