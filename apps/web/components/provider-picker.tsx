"use client";

import { useState } from "react";

import { OsCommandTabs } from "@/components/os-command-tabs";
import { cn } from "@/lib/utils";
import { setupCommandUnix, setupCommandWindows } from "@/lib/setup-command";
import { AVAILABLE_PROVIDERS, DEFAULT_PROVIDER_IDS, type DashboardProvider } from "@/lib/providers";

const SETUP_SCRIPT_SH_SOURCE_URL =
  "https://github.com/RamiSmat/primetime/blob/main/scripts/setup-warmup-repo.sh";
const SETUP_SCRIPT_PS1_SOURCE_URL =
  "https://github.com/RamiSmat/primetime/blob/main/scripts/setup-warmup-repo.ps1";

const PROVIDER_STEP_COPY: Record<DashboardProvider["id"], string> = {
  codex: "Sends your local Codex session straight to this repo's secrets via gh (never through PrimeTime)",
  "claude-code":
    "Sends your local Claude Code token straight to this repo's secrets via gh (never through PrimeTime)",
};

export function ProviderPicker({
  repositoryFullName,
  primeTimeWebUrl,
}: {
  repositoryFullName: string;
  primeTimeWebUrl: string;
}) {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(DEFAULT_PROVIDER_IDS);

  function toggle(providerId: string) {
    setSelectedIds((current) => {
      const isSelected = current.includes(providerId);
      if (isSelected) {
        // Refuse to deselect the last remaining provider — the setup
        // command needs at least one to do anything useful.
        return current.length === 1 ? current : current.filter((id) => id !== providerId);
      }
      return [...current, providerId];
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Which providers do you want to warm up?</p>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_PROVIDERS.map((provider) => {
            const isSelected = selectedIds.includes(provider.id);
            return (
              <button
                key={provider.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(provider.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  isSelected
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {provider.label}
              </button>
            );
          })}
        </div>
      </div>

      <OsCommandTabs
        defaultOs="unix"
        commands={[
          {
            id: "unix",
            label: "macOS / Linux",
            code: setupCommandUnix(repositoryFullName, primeTimeWebUrl, selectedIds),
            reviewHref: SETUP_SCRIPT_SH_SOURCE_URL,
          },
          {
            id: "windows",
            label: "Windows (PowerShell)",
            code: setupCommandWindows(repositoryFullName, primeTimeWebUrl, selectedIds),
            reviewHref: SETUP_SCRIPT_PS1_SOURCE_URL,
          },
        ]}
      />

      <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span aria-hidden className="text-foreground">
            ·
          </span>
          Checks that git, node, gh, and the CLI for each provider above are installed
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-foreground">
            ·
          </span>
          Logs you into gh / each provider, only if you aren&apos;t already
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-foreground">
            ·
          </span>
          Creates this repository (via gh) if it doesn&apos;t exist yet
        </li>
        {selectedIds.map((id) => (
          <li key={id} className="flex gap-2">
            <span aria-hidden className="text-foreground">
              ·
            </span>
            {PROVIDER_STEP_COPY[id as DashboardProvider["id"]]}
          </li>
        ))}
        <li className="flex gap-2">
          <span aria-hidden className="text-foreground">
            ·
          </span>
          Adds the scheduled workflow file for each provider above to this repo
        </li>
      </ul>
    </div>
  );
}
