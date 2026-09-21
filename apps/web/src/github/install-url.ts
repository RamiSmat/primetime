/**
 * The GitHub App's public "install on a repository" page — the only URL
 * that actually installs the App (hitting `/login/oauth/authorize`
 * directly for an app that isn't installed yet only grants a user access
 * token; it installs nothing). Only use this for an account that doesn't
 * have the App installed at all: for an account that already has it
 * installed, this same URL skips straight to GitHub's "manage
 * installation" settings page and never redirects back to PrimeTime
 * (confirmed against the real deployment) — see `OauthIntent`'s doc
 * comment in `session.ts` for how the two flows are split.
 */
export function buildInstallUrl(options: { readonly state: string }): string {
  const slug = process.env["GITHUB_APP_SLUG"];
  if (!slug) {
    throw new Error("GITHUB_APP_SLUG is not set.");
  }
  const url = new URL(`https://github.com/apps/${slug}/installations/new`);
  url.searchParams.set("state", options.state);
  return url.toString();
}
