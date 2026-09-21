import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from "./session";

export async function getCurrentUser(): Promise<SessionPayload | undefined> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return undefined;
  }
  return verifySessionToken(token);
}
