import { NextResponse } from "next/server";

import { buildAuthorizeUrl } from "@/src/auth/github-oauth";
import { encodeOauthState, OAUTH_STATE_COOKIE_NAME, type OauthIntent } from "@/src/auth/session";

const OAUTH_STATE_MAX_AGE_SECONDS = 600;

export async function GET(request: Request): Promise<Response> {
  const clientId = process.env["GITHUB_APP_CLIENT_ID"];
  if (!clientId) {
    return NextResponse.json({ error: "GITHUB_APP_CLIENT_ID is not set." }, { status: 500 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const intent: OauthIntent = url.searchParams.get("intent") === "provision-repo" ? "provision-repo" : "signin";
  const state = encodeOauthState(intent);

  const response = NextResponse.redirect(
    buildAuthorizeUrl({
      clientId,
      redirectUri: `${origin}/api/auth/callback`,
      state,
    }),
  );

  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return response;
}
