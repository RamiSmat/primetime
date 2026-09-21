import { defaultGhRunner, resolveRepository, setRepositorySecret, type GhRunner } from "@primetime/github";

/**
 * GitHub's default `GITHUB_TOKEN` cannot manage repository secrets, so a
 * scheduled workflow that needs to write a refreshed provider session back
 * (see the Codex provider's GitHub Actions credential setup docs) needs its
 * own narrowly-scoped fine-grained PAT — permission: this one repository's
 * "Secrets: Read and write" only. GitHub gives no API to mint a PAT
 * programmatically, so the user creates it by hand and this just transfers
 * that value to the repository as a secret, the same way `setup()` does for
 * a provider session.
 */
export const PRIMETIME_SECRETS_PAT_NAME = "PRIMETIME_SECRETS_PAT";

export async function setupGithubSecretsPat(
  patValue: string,
  ghRunner: GhRunner = defaultGhRunner,
): Promise<string> {
  const repository = await resolveRepository(ghRunner);
  await setRepositorySecret({ name: PRIMETIME_SECRETS_PAT_NAME, value: patValue, repository }, ghRunner);
  return `Stored ${PRIMETIME_SECRETS_PAT_NAME} for ${repository.owner}/${repository.name}.`;
}
