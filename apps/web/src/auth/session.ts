import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "pt_session";
export const OAUTH_STATE_COOKIE_NAME = "pt_oauth_state";

/**
 * `signin` is the ordinary "sign in with GitHub" flow. `provision-repo`
 * round-trips through GitHub's OAuth authorize screen (which, for a GitHub
 * App with "Request user authorization during installation" enabled, also
 * handles installing the App if it isn't installed yet) to get a fresh user
 * access token, used once in the callback to create the user's dedicated
 * warmup repository — never persisted.
 */
export type OauthIntent = "signin" | "provision-repo";

const INTENT_SEPARATOR = "~";

export function encodeOauthState(intent: OauthIntent): string {
  return `${randomToken()}${INTENT_SEPARATOR}${intent}`;
}

export function decodeOauthIntent(state: string): OauthIntent {
  const [, intent] = state.split(INTENT_SEPARATOR);
  return intent === "provision-repo" ? "provision-repo" : "signin";
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
