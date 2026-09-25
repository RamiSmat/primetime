export interface ProviderDetectionResult {
  readonly available: boolean;
}

export interface ProviderSetupResult {
  readonly configured: boolean;
  readonly message: string;
}

export interface AuthValidationResult {
  readonly authenticated: boolean;
}

export type PrimeErrorCategory =
  | "cli_unavailable"
  | "authentication_required"
  | "timeout"
  | "rate_limited"
  | "unknown_failure";

export interface PrimeResult {
  readonly success: boolean;
  readonly provider: string;
  readonly durationMs: number;
  readonly errorCategory: PrimeErrorCategory | null;
  readonly message: string;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  /**
   * Minutes this provider's AI-subscription usage window stays warm after
   * being started/refreshed by a primer (or the user's own activity),
   * before `@primetime/scheduler` needs to re-prime it. Provider-specific
   * and currently hardcoded — see each provider's own constant for the
   * source/date it was verified against. Not user-configurable yet.
   */
  readonly usageWindowMinutes: number;

  detect(): Promise<ProviderDetectionResult>;
  setup(): Promise<ProviderSetupResult>;
  validateAuthentication(): Promise<AuthValidationResult>;
  prime(): Promise<PrimeResult>;
}

export type ProviderOperation =
  | "detection"
  | "setup"
  | "authentication validation"
  | "priming";
