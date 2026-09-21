import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { buildAuthorizeUrl } from "@/src/auth/github-oauth";
import { OAUTH_STATE_COOKIE_NAME } from "@/src/auth/session";

const OAUTH_STATE_MAX_AGE_SECONDS = 600;

export async function GET(request: Request): Promise<Response> {
  const clientId = process.env["GITHUB_APP_CLIENT_ID"];
  if (!clientId) {
    return NextResponse.json({ error: "GITHUB_APP_CLIENT_ID is not set." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const state = randomUUID();

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
