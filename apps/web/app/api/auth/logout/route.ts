import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/src/auth/session";

export async function POST(request: Request): Promise<Response> {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
