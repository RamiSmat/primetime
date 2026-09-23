import type { ScheduleConfig } from "@primetime/scheduler";

const SETUP_SCRIPT_SH_RAW_URL =
  "https://raw.githubusercontent.com/RamiSmat/primetime/main/scripts/setup-warmup-repo.sh";
const SETUP_SCRIPT_PS1_RAW_URL =
  "https://raw.githubusercontent.com/RamiSmat/primetime/main/scripts/setup-warmup-repo.ps1";

/**
 * Base64-encodes the saved schedule so the setup script can carry it into
 * the target repo as `.primetime/schedule.json` without ever calling back
 * to PrimeTime's backend at run time — see `--schedule-base64` in
 * `scripts/setup-warmup-repo.sh`/`.ps1`.
 */
function scheduleBase64(scheduleConfig: ScheduleConfig): string {
  return Buffer.from(JSON.stringify(scheduleConfig), "utf8").toString("base64");
}

export function setupCommandUnix(
  repositoryFullName: string,
  primeTimeWebUrl: string,
  providerIds: readonly string[],
  scheduleConfig: ScheduleConfig,
): string {
  const args = [
    repositoryFullName,
    primeTimeWebUrl,
    ...providerIds,
    `--schedule-base64=${scheduleBase64(scheduleConfig)}`,
  ].join(" ");
  return `curl -fsSL ${SETUP_SCRIPT_SH_RAW_URL} | bash -s -- ${args}`;
}

export function setupCommandWindows(
  repositoryFullName: string,
  primeTimeWebUrl: string,
  providerIds: readonly string[],
  scheduleConfig: ScheduleConfig,
): string {
  const args = [
    repositoryFullName,
    primeTimeWebUrl,
    ...providerIds,
    `--schedule-base64=${scheduleBase64(scheduleConfig)}`,
  ]
    .map((value) => `"${value}"`)
    .join(" ");
  return `&([scriptblock]::Create((irm ${SETUP_SCRIPT_PS1_RAW_URL}))) ${args}`;
}
