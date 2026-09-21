#!/usr/bin/env bash
#
# PrimeTime warmup repo setup script.
#
# Review this before you run it — that's the whole point of it being a
# plain, readable shell script instead of a black box:
#   https://github.com/RamiSmat/primetime/blob/main/scripts/setup-warmup-repo.sh
#
# This is the macOS/Linux (bash) version. On Windows, use the PowerShell
# twin instead: scripts/setup-warmup-repo.ps1 -- keep the two in sync.
#
# Usage:
#   curl -fsSL <raw-url-to-this-file> | bash -s -- <owner>/<repo> <primetime-web-url>
#
# What this does, in order (each step below is announced before it runs):
#   1. Checks that git, node, npm, gh, and codex are all on your PATH.
#   2. Makes sure you're logged into `gh` and Codex, prompting you to log in
#      (in your terminal / browser) only if you aren't already.
#   3. Creates <repo> (as private) via `gh repo create`, if it doesn't
#      already exist. PrimeTime's backend never creates repositories
#      itself — GitHub rejects that from any kind of GitHub App token, by
#      design — so this always runs as your own full `gh` login.
#   4. Clones and builds PrimeTime into a throwaway temp directory that is
#      deleted when this script exits — PrimeTime isn't published as an
#      installable package yet, so this is how the CLI is run for now.
#   5. Sends your local Codex session to <repo>'s CODEX_AUTH_JSON secret.
#      `gh` encrypts it and sends it directly to GitHub's API — this script
#      and PrimeTime's own backend never see the session itself.
#   6. Adds or updates .github/workflows/primetime-codex-primer.yml in
#      <repo> via the GitHub API — no local clone of <repo> needed.
#
# Safe to re-run at any time.

set -euo pipefail

REPO="${1:?Usage: setup-warmup-repo.sh <owner>/<repo> <primetime-web-url>}"
PRIMETIME_WEB_URL="${2:?Usage: setup-warmup-repo.sh <owner>/<repo> <primetime-web-url>}"

PRIMETIME_SOURCE_REPO="https://github.com/RamiSmat/primetime.git"
RAW_TEMPLATE_URL="https://raw.githubusercontent.com/RamiSmat/primetime/main/templates/github-actions/codex-prime-hosted.yml"
WORKFLOW_PATH=".github/workflows/primetime-codex-primer.yml"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { echo "error: $1" >&2; exit 1; }

step "Checking prerequisites"
for cmd in git node npm gh codex; do
  command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' is required but wasn't found on PATH. Install it and re-run this script."
done
echo "  git, node, npm, gh, and codex are all installed."

step "Checking GitHub CLI login"
if gh auth status >/dev/null 2>&1; then
  echo "  Already logged in."
else
  echo "  Not logged in — starting 'gh auth login' (this will prompt you)."
  gh auth login < /dev/tty
fi

step "Checking Codex login"
if codex login status 2>&1 | grep -qi "not logged in"; then
  echo "  Not logged in — starting 'codex login' (this will prompt you)."
  codex login < /dev/tty
else
  echo "  Already logged in (the next step will tell you if it's not a usable login method)."
fi

step "Ensuring $REPO exists"
if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "  Already exists."
else
  echo "  Creating it as a new private repository."
  gh repo create "$REPO" --private \
    --description "Created by PrimeTime — holds the scheduled workflow that warms up your AI coding CLI." \
    >/dev/null
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

step "Cloning PrimeTime into a temporary directory"
echo "  $WORKDIR/primetime — deleted automatically when this script exits."
git clone --quiet --depth 1 "$PRIMETIME_SOURCE_REPO" "$WORKDIR/primetime"

step "Building PrimeTime"
(cd "$WORKDIR/primetime" && npm install && npm run build)

step "Sending your Codex session to $REPO as the CODEX_AUTH_JSON secret"
echo "  gh performs GitHub's required encryption locally; nothing passes through PrimeTime's backend."
GH_REPO="$REPO" node "$WORKDIR/primetime/apps/cli/dist/src/bin.js" setup codex

step "Adding the scheduled workflow to $REPO"
TMP_WORKFLOW="$WORKDIR/workflow.yml"
curl -fsSL "$RAW_TEMPLATE_URL" | sed "s#https://primetime.example.invalid#${PRIMETIME_WEB_URL}#g" > "$TMP_WORKFLOW"

EXISTING_SHA="$(gh api "repos/$REPO/contents/$WORKFLOW_PATH" --jq '.sha' 2>/dev/null || true)"
CONTENT_B64="$(base64 < "$TMP_WORKFLOW" | tr -d '\n')"
if [ -n "$EXISTING_SHA" ]; then
  echo "  $WORKFLOW_PATH already exists in $REPO — updating it."
  gh api --method PUT "repos/$REPO/contents/$WORKFLOW_PATH" \
    -f message="Update PrimeTime scheduled workflow" -f content="$CONTENT_B64" -f sha="$EXISTING_SHA" >/dev/null
else
  echo "  Creating $WORKFLOW_PATH."
  gh api --method PUT "repos/$REPO/contents/$WORKFLOW_PATH" \
    -f message="Add PrimeTime scheduled workflow" -f content="$CONTENT_B64" >/dev/null
fi

step "Done"
echo "  $REPO is set up. $WORKFLOW_PATH runs on its own cron schedule —"
echo "  edit that schedule, or trigger it once by hand from the repo's Actions tab to test it now."
