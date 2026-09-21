import { PrimeTimeError } from "@primetime/shared";

import type {
  AuthValidationResult,
  PrimeResult,
  ProviderAdapter,
  ProviderDetectionResult,
  ProviderOperation,
  ProviderSetupResult,
} from "../adapter.js";

export class ProviderOperationNotImplementedError extends PrimeTimeError {
  public constructor(providerName: string, operation: ProviderOperation) {
    super(
      "not_implemented",
      `${providerName} provider ${operation} is not implemented yet. No credentials were read or changed.`,
    );
    this.name = "ProviderOperationNotImplementedError";
  }
}

export class CodexProvider implements ProviderAdapter {
  public readonly id = "codex";
  public readonly name = "Codex";

  public async detect(): Promise<ProviderDetectionResult> {
    throw new ProviderOperationNotImplementedError(this.name, "detection");
  }

  public async setup(): Promise<ProviderSetupResult> {
    throw new ProviderOperationNotImplementedError(this.name, "setup");
  }

  public async validateAuthentication(): Promise<AuthValidationResult> {
    throw new ProviderOperationNotImplementedError(
      this.name,
      "authentication validation",
    );
  }

  public async prime(): Promise<PrimeResult> {
    throw new ProviderOperationNotImplementedError(this.name, "priming");
  }
}

export const codexProvider: ProviderAdapter = new CodexProvider();
