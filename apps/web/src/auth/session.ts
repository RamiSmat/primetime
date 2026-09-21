import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "pt_session";
export const OAUTH_STATE_COOKIE_NAME = "pt_oauth_state";

/**
 * `signin` is the ordinary "sign in with GitHub" flow.
 *
 * `provision-repo` and `install-app` both end up running the same
 * provisioning logic in the callback, but start from different GitHub
 * URLs: visiting `/apps/<slug>/installations/new` only walks the user
 * through GitHub's OAuth authorize screen too (the step that actually
 * hands the callback a `code`) when the App *isn't already installed* for
 * that account — installing is a one-time event. For an account that
 * already has the App installed, that same URL just takes them to GitHub's
 * "manage installation" settings page and never returns to PrimeTime at
 * all (confirmed against the real deployment). So `provision-repo` (the
 * dashboard's default "Create my warmup repository" button) uses the
 * plain authorize URL, which works reliably regardless of install state;
 * `install-app` (shown only once the callback reports no installation
 * exists yet) uses the install URL, for that one first-time case.
 */
export type OauthIntent = "signin" | "provision-repo" | "install-app";

const INTENT_SEPARATOR = "~";

export function encodeOauthState(intent: OauthIntent): string {
  return `${randomToken()}${INTENT_SEPARATOR}${intent}`;
}

export function decodeOauthIntent(state: string): OauthIntent {
  const [, intent] = state.split(INTENT_SEPARATOR);
  return intent === "provision-repo" || intent === "install-app" ? intent : "signin";
}

function randomToken(): string {
  return crypto.randomUUID();
}

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * A signed session identifies which GitHub account is browsing the
 * dashboard so it can be matched against `github_installations.account_login`
 * (populated only from webhook deliveries). It never carries a GitHub
 * access token or any provider (Codex/Claude/etc.) credential — session
 * cookies here are purely "who is this person on GitHub", not "what can
 * this person authenticate as".
 */
export interface SessionPayload {
  readonly login: string;
  readonly userId: number;
  readonly avatarUrl: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET is not set.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ login: payload.login, userId: payload.userId, avatarUrl: payload.avatarUrl })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | undefined> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload["login"] !== "string" ||
      typeof payload["userId"] !== "number" ||
      typeof payload["avatarUrl"] !== "string"
    ) {
      return undefined;
    }
    return { login: payload["login"], userId: payload["userId"], avatarUrl: payload["avatarUrl"] };
  } catch {
    return undefined;
  }
}

export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;
