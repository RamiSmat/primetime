/**
 * A copy of `templates/github-actions/codex-prime-hosted.yml` with
 * `PRIMETIME_WEB_URL`/`OIDC_AUDIENCE` pre-filled for this deployment, so the
 * dashboard can hand users a ready-to-paste workflow file instead of one
 * they have to hand-edit. Vercel's serverless bundle doesn't include
 * arbitrary repo files outside `apps/web`, so this is kept as a literal
 * string here — keep it in sync with the template file when that changes.
 */
export function buildHostedWorkflowYaml(primeTimeWebUrl: string): string {
  return `name: PrimeTime Codex primer (hosted)

# Generated for your PrimeTime deployment by the PrimeTime dashboard.
# Copy this file into .github/workflows/ in your own PrimeTime-controlled
# repository. It trusts this hosted PrimeTime backend to mint the token that
# writes the refreshed Codex session back to this repo's own secret, instead
# of a hand-created PAT. It never trusts that backend with the Codex session
# itself -- CODEX_AUTH_JSON still moves directly between this runner and this
# repository's own secrets.

on:
  schedule:
    # Placeholder cadence -- replace with your own computed schedule (see
    # \`primetime schedule next\`).
    - cron: "30 13 * * 1-5"
  workflow_dispatch: {}

permissions:
  contents: read
  # Required so this job can request a GitHub Actions OIDC token proving
  # "I am run X of workflow Y in repo Z" to the PrimeTime backend below.
  id-token: write

concurrency:
  group: primetime-codex-primer-hosted
  cancel-in-progress: false

env:
  PRIMETIME_WEB_URL: ${primeTimeWebUrl}
  OIDC_AUDIENCE: ${primeTimeWebUrl}

jobs:
  prime:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Check out PrimeTime
        uses: actions/checkout@v4
        with:
          repository: RamiSmat/primetime
          ref: main
          path: primetime

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install PrimeTime
        working-directory: primetime
        run: |
          npm ci
          npm run build

      - name: Install the official Codex CLI
        run: npm install -g @openai/codex

      - name: Restore the Codex session
        id: restore
        env:
          CODEX_AUTH_JSON: \${{ secrets.CODEX_AUTH_JSON }}
        run: |
          if [ -z "$CODEX_AUTH_JSON" ]; then
            echo "::error::CODEX_AUTH_JSON is not set. Run 'primetime setup codex' locally first." >&2
            exit 1
          fi
          mkdir -p "$HOME/.codex"
          printf '%s' "$CODEX_AUTH_JSON" > "$HOME/.codex/auth.json"
          chmod 600 "$HOME/.codex/auth.json"

      - name: Run the Codex primer
        run: node primetime/apps/cli/dist/src/bin.js prime codex

      - name: Persist the refreshed Codex session
        if: always() && steps.restore.outcome == 'success'
        env:
          GH_REPO: \${{ github.repository }}
        run: |
          oidc_request_url="\${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=\${OIDC_AUDIENCE}"
          oidc_token=$(curl -sf -H "Authorization: bearer \${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" "$oidc_request_url" | jq -r '.value')

          if [ -z "$oidc_token" ] || [ "$oidc_token" = "null" ]; then
            echo "::warning::Could not obtain a GitHub Actions OIDC token, so the refreshed Codex session could not be saved." >&2
            exit 0
          fi

          install_token=$(curl -sf -X POST \\
            -H "Authorization: Bearer \${oidc_token}" \\
            -H "Content-Type: application/json" \\
            "\${PRIMETIME_WEB_URL}/api/actions/token" | jq -r '.token')

          if [ -z "$install_token" ] || [ "$install_token" = "null" ]; then
            echo "::warning::PrimeTime backend did not return an installation token. Confirm the PrimeTime GitHub App is installed on this repository." >&2
            exit 0
          fi

          GH_TOKEN="$install_token" node primetime/apps/cli/dist/src/bin.js setup codex
`;
}
