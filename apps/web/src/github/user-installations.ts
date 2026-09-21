export interface UserAppInstallation {
  readonly installationId: number;
  readonly accountLogin: string;
  readonly repositorySelection: "all" | "selected";
}

/**
 * Looks up the signed-in user's installation of *this* GitHub App directly
 * from GitHub (via their just-issued user access token), rather than our
 * own DB — this is always fresh and lets the one-click "create my warmup
 * repo" flow know immediately whether the install covers "all
 * repositories" (required — see `provisionWarmupRepo`) without waiting on
 * a webhook delivery.
 */
export async function findUserAppInstallation(
  accessToken: string,
  appId: string,
): Promise<UserAppInstallation | undefined> {
  const response = await fetch("https://api.github.com/user/installations", {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/vnd.github+json",
      "user-agent": "primetime-web",
    },
  });

  if (!response.ok) {
    throw new Error("Could not list the user's GitHub App installations.");
  }

  const body = (await response.json()) as {
    installations?: ReadonlyArray<{
      id: number;
      app_id: number;
      repository_selection: string;
      account: { login: string };
    }>;
  };

  const match = body.installations?.find((installation) => String(installation.app_id) === appId);
  if (!match) {
    return undefined;
  }

  return {
    installationId: match.id,
    accountLogin: match.account.login,
    repositorySelection: match.repository_selection === "all" ? "all" : "selected",
  };
}
