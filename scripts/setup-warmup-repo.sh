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
#   curl -fsSL <raw-url-to-this-file> | bash -s -- <owner>/<repo> <primetime-web-url> [provider...]
#
# <provider...> is one or more of: codex, claude-code. Defaults to "codex"
# alone when omitted.
#
# What this does, in order (each step below is announced before it runs):
#   1. Checks that git, node, npm, gh, and each selected provider's CLI are
#      all on your PATH.
#   2. Makes sure you're logged into `gh` and each selected provider,
#      prompting you to log in (in your terminal / browser) only if you
#      aren't already.
#   3. Creates <repo> (as private) via `gh repo create`, if it doesn't
#      already exist. PrimeTime's backend never creates repositories
#      itself — GitHub rejects that from any kind of GitHub App token, by
#      design — so this always runs as your own full `gh` login.
#   4. Clones and builds PrimeTime into a throwaway temp directory that is
#      deleted when this script exits — PrimeTime isn't published as an
#      installable package yet, so this is how the CLI is run for now.
#   5. Sends your local session/token for each selected provider to
#      <repo>'s secrets. `gh` encrypts it and sends it directly to GitHub's
#      API — this script and PrimeTime's own backend never see it.
#   6. Adds or updates the scheduled workflow file for each selected
#      provider in <repo> via the GitHub API — no local clone of <repo>
#      needed.
#
# Safe to re-run at any time.

set -euo pipefail

REPO="${1:?Usage: setup-warmup-repo.sh <owner>/<repo> <primetime-web-url> [provider...]}"
PRIMETIME_WEB_URL="${2:?Usage: setup-warmup-repo.sh <owner>/<repo> <primetime-web-url> [provider...]}"
shift 2 || true
PROVIDERS=("$@")
if [ "${#PROVIDERS[@]}" -eq 0 ]; then
  PROVIDERS=("codex")
fi

PRIMETIME_SOURCE_REPO="https://github.com/RamiSmat/primetime.git"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { echo "error: $1" >&2; exit 1; }

provider_label() {
  case "$1" in
    codex) echo "Codex" ;;
    claude-code) echo "Claude Code" ;;
    *) die "Unknown provider '$1'. Supported providers: codex, claude-code." ;;
  esac
}

provider_cli_binary() {
  case "$1" in
    codex) echo "codex" ;;
    claude-code) echo "claude" ;;
  esac
}

provider_template_url() {
  case "$1" in
    codex) echo "https://raw.githubusercontent.com/RamiSmat/primetime/main/templates/github-actions/codex-prime-hosted.yml" ;;
    claude-code) echo "https://raw.githubusercontent.com/RamiSmat/primetime/main/templates/github-actions/claude-code-prime.yml" ;;
  esac
}

provider_workflow_path() {
  case "$1" in
    codex) echo ".github/workflows/primetime-codex-primer.yml" ;;
    claude-code) echo ".github/workflows/primetime-claude-code-primer.yml" ;;
  esac
}

# Runs each provider's local login-check-and-transfer flow, storing its
# credential as this repo's secret via `primetime setup <provider>`.
setup_provider() {
  case "$1" in
    codex)
      step "Checking Codex login"
      if codex login status 2>&1 | grep -qi "not logged in"; then
        echo "  Not logged in — starting 'codex login' (this will prompt you)."
        codex login < /dev/tty
      else
        echo "  Already logged in (the next step will tell you if it's not a usable login method)."
      fi

      step "Sending your Codex session to $REPO as the CODEX_AUTH_JSON secret"
      echo "  gh performs GitHub's required encryption locally; nothing passes through PrimeTime's backend."
      GH_REPO="$REPO" node "$WORKDIR/primetime/apps/cli/dist/src/bin.js" setup codex
      ;;
    claude-code)
      step "Getting a Claude Code CI token"
      echo "  Running 'claude setup-token' — it opens a browser to authorize if needed, then prints a one-year token."
      CLAUDE_CODE_TOKEN="$(claude setup-token)"

      step "Sending it to $REPO as the CLAUDE_CODE_OAUTH_TOKEN secret"
      echo "  gh performs GitHub's required encryption locally; nothing passes through PrimeTime's backend."
      GH_REPO="$REPO" printf '%s' "$CLAUDE_CODE_TOKEN" | node "$WORKDIR/primetime/apps/cli/dist/src/bin.js" setup claude-code
      ;;
  esac
}

for provider in "${PROVIDERS[@]}"; do
  provider_label "$provider" >/dev/null
done

step "Checking prerequisites"
REQUIRED_CMDS=(git node npm gh)
for provider in "${PROVIDERS[@]}"; do
  REQUIRED_CMDS+=("$(provider_cli_binary "$provider")")
done
for cmd in "${REQUIRED_CMDS[@]}"; do
  command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' is required but wasn't found on PATH. Install it and re-run this script."
done
echo "  ${REQUIRED_CMDS[*]} are all installed."

step "Checking GitHub CLI login"
if gh auth status >/dev/null 2>&1; then
  echo "  Already logged in."
else
  echo "  Not logged in — starting 'gh auth login' (this will prompt you)."
  gh auth login < /dev/tty
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

for provider in "${PROVIDERS[@]}"; do
  setup_provider "$provider"
done

for provider in "${PROVIDERS[@]}"; do
  label="$(provider_label "$provider")"
  workflow_path="$(provider_workflow_path "$provider")"
  template_url="$(provider_template_url "$provider")"

  step "Adding the $label scheduled workflow to $REPO"
  tmp_workflow="$WORKDIR/workflow-$provider.yml"
  curl -fsSL "$template_url" | sed "s#https://primetime.example.invalid#${PRIMETIME_WEB_URL}#g" > "$tmp_workflow"

  existing_sha="$(gh api "repos/$REPO/contents/$workflow_path" --jq '.sha' 2>/dev/null || true)"
  content_b64="$(base64 < "$tmp_workflow" | tr -d '\n')"
  if [ -n "$existing_sha" ]; then
    echo "  $workflow_path already exists in $REPO — updating it."
    gh api --method PUT "repos/$REPO/contents/$workflow_path" \
      -f message="Update PrimeTime $label scheduled workflow" -f content="$content_b64" -f sha="$existing_sha" >/dev/null
  else
    echo "  Creating $workflow_path."
    gh api --method PUT "repos/$REPO/contents/$workflow_path" \
      -f message="Add PrimeTime $label scheduled workflow" -f content="$content_b64" >/dev/null
  fi
done

step "Done"
echo "  $REPO is set up. Each workflow added above runs on its own cron schedule —"
echo "  edit that schedule, or trigger one by hand from the repo's Actions tab to test it now."
