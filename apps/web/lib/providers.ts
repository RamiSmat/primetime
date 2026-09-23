// This deliberately does not import `@primetime/providers` — per this
// repo's package boundaries, `apps/web` never runs a provider adapter
// itself, so it only needs a display list of the provider ids the CLI
// already supports (`packages/providers/src/registry.ts`), not the
// adapters themselves.

export interface DashboardProvider {
  readonly id: "codex" | "claude-code";
  readonly label: string;
}

export const AVAILABLE_PROVIDERS: readonly DashboardProvider[] = [
  { id: "codex", label: "Codex" },
  { id: "claude-code", label: "Claude Code" },
];

export const DEFAULT_PROVIDER_IDS: readonly string[] = AVAILABLE_PROVIDERS.map(
  (provider) => provider.id,
);
