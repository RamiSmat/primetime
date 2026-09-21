/** The GitHub App's public "install on a repository" page. */
export function buildInstallUrl(): string {
  const slug = process.env["GITHUB_APP_SLUG"];
  if (!slug) {
    throw new Error("GITHUB_APP_SLUG is not set.");
  }
  return `https://github.com/apps/${slug}/installations/new`;
}
