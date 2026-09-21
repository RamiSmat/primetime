import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeCodeForAccessToken, fetchGithubOauthUser } from "@/src/auth/github-oauth";
import {
  createSessionToken,
  decodeOauthIntent,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
} from "@/src/auth/session";
import { getInstallationStore } from "@/src/db/store";
import { findUserAppInstallation } from "@/src/github/user-installations";
import { provisionWarmupRepo, RepositorySelectionNotAllError } from "@/src/github/provision-repo";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/?error=oauth_state", url.origin));
  }

  const clientId = process.env["GITHUB_APP_CLIENT_ID"];
  const clientSecret = process.env["GITHUB_APP_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "GITHUB_APP_CLIENT_ID / GITHUB_APP_CLIENT_SECRET are not set." },
      { status: 500 },
    );
  }

  const intent = decodeOauthIntent(state);

  try {
    const accessToken = await exchangeCodeForAccessToken({
      clientId,
      clientSecret,
      code,
      redirectUri: `${url.origin}/api/auth/callback`,
    });
    const user = await fetchGithubOauthUser(accessToken);
    const sessionToken = await createSessionToken({
      login: user.login,
      userId: user.userId,
      avatarUrl: user.avatarUrl,
    });

    const dashboardUrl = new URL("/dashboard", url.origin);
    if (intent === "provision-repo") {
      await runProvisioning(accessToken, dashboardUrl);
    }

    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth_failed", url.origin));
  }
}

/** Mutates `dashboardUrl`'s query string to report the outcome. */
async function runProvisioning(accessToken: string, dashboardUrl: URL): Promise<void> {
  const appId = process.env["GITHUB_APP_ID"];
  if (!appId) {
    dashboardUrl.searchParams.set("error", "provision_failed");
    return;
  }

  const installation = await findUserAppInstallation(accessToken, appId);
  if (!installation) {
    dashboardUrl.searchParams.set("error", "not_installed");
    return;
  }

  try {
    await provisionWarmupRepo({ accessToken, installation, store: getInstallationStore() });
    dashboardUrl.searchParams.set("created", "1");
  } catch (error) {
    if (error instanceof RepositorySelectionNotAllError) {
      dashboardUrl.searchParams.set("error", "needs_all_repos");
      dashboardUrl.searchParams.set("installationId", String(error.installationId));
    } else {
      dashboardUrl.searchParams.set("error", "provision_failed");
    }
  }
}
