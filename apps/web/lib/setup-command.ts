const SETUP_SCRIPT_SH_RAW_URL =
  "https://raw.githubusercontent.com/RamiSmat/primetime/main/scripts/setup-warmup-repo.sh";
const SETUP_SCRIPT_PS1_RAW_URL =
  "https://raw.githubusercontent.com/RamiSmat/primetime/main/scripts/setup-warmup-repo.ps1";

export function setupCommandUnix(
  repositoryFullName: string,
  primeTimeWebUrl: string,
  providerIds: readonly string[],
): string {
  const args = [repositoryFullName, primeTimeWebUrl, ...providerIds].join(" ");
  return `curl -fsSL ${SETUP_SCRIPT_SH_RAW_URL} | bash -s -- ${args}`;
}

export function setupCommandWindows(
  repositoryFullName: string,
  primeTimeWebUrl: string,
  providerIds: readonly string[],
): string {
  const args = [repositoryFullName, primeTimeWebUrl, ...providerIds]
    .map((value) => `"${value}"`)
    .join(" ");
  return `&([scriptblock]::Create((irm ${SETUP_SCRIPT_PS1_RAW_URL}))) ${args}`;
}
