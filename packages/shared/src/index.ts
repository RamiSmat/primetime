export type FailureKind =
  | "authentication_expired"
  | "provider_unavailable"
  | "rate_limited"
  | "cli_unavailable"
  | "invalid_configuration"
  | "network_failure"
  | "not_implemented"
  | "unknown_failure";

export class PrimeTimeError extends Error {
  public constructor(
    public readonly kind: FailureKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PrimeTimeError";
  }
}
