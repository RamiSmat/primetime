import { NextResponse } from "next/server";

import { buildAuthorizeUrl } from "@/src/auth/github-oauth";
import { encodeOauthState, OAUTH_STATE_COOKIE_NAME, type OauthIntent } from "@/src/auth/session";
import { buildInstallUrl } from "@/src/github/install-url";

const OAUTH_STATE_MAX_AGE_SECONDS = 600;

export async function GET(request: Request): Promise<Response> {
  const clientId = process.env["GITHUB_APP_CLIENT_ID"];
  if (!clientId) {
    return NextResponse.json({ error: "GITHUB_APP_CLIENT_ID is not set." }, { status: 500 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const requestedIntent = url.searchParams.get("intent");
  const intent: OauthIntent =
    requestedIntent === "provision-repo" || requestedIntent === "install-app" ? requestedIntent : "signin";
  const state = encodeOauthState(intent);

  // Only `install-app` goes through the install URL — that's the one that
  // actually installs the App, but only walks the user through OAuth
  // authorization (the step that hands the callback a `code`) on a
  // genuinely new install; for an account that already has the App
  // installed it just opens GitHub's "manage installation" settings page
  // and never comes back (confirmed against the real deployment). Every
  // other intent, including `provision-repo`, uses the plain authorize
  // URL, which works the same regardless of install state — the callback
  // itself checks whether an installation exists.
  const destination =
    intent === "install-app"
      ? buildInstallUrl({ state })
      : buildAuthorizeUrl({ clientId, redirectUri: `${origin}/api/auth/callback`, state });

  const response = NextResponse.redirect(destination);

  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return response;
}
