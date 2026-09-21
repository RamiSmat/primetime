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
