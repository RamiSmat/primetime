export interface ProviderDetectionResult {
  readonly available: boolean;
}

export interface ProviderSetupResult {
  readonly configured: boolean;
}

export interface AuthValidationResult {
  readonly authenticated: boolean;
}

export interface PrimeResult {
  readonly success: boolean;
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
