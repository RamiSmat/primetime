/**
 * The GitHub App's public "install on a repository" page. Unlike
 * `/login/oauth/authorize` (used for plain sign-in), visiting this URL is
 * what actually installs the App on the user's account — hitting the plain
 * authorize endpoint for an app that isn't installed yet only grants a user
 * access token, it does not install anything (confirmed against this
 * project's own GitHub App: it left `GET /user/installations` empty).
 * With "Request user authorization (OAuth) during installation" enabled on
 * the App, completing this install flow also redirects through the same
 * OAuth callback with a `code` — so `provisionWarmupRepo`'s single round
 * trip still works, it just has to start here instead.
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
