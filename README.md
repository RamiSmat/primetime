# PrimeTime

[![License: ISC](https://img.shields.io/github/license/RamiSmat/primetime)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/RamiSmat/primetime?style=flat)](https://github.com/RamiSmat/primetime/stargazers)
[![Open issues](https://img.shields.io/github/issues/RamiSmat/primetime)](https://github.com/RamiSmat/primetime/issues)
[![Last commit](https://img.shields.io/github/last-commit/RamiSmat/primetime)](https://github.com/RamiSmat/primetime/commits/main)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

PrimeTime is an early-stage utility for scheduling lightweight primer requests
for AI coding tools. Provider credentials must remain on user-controlled
infrastructure and must never pass through a PrimeTime backend.

## Current scope

This repository currently contains a minimal TypeScript monorepo with:

- a `primetime prime <provider>`, `primetime schedule next <config-path>`,
  `primetime setup <provider>`, and `primetime setup github-secrets-pat`
  CLI;
- a provider adapter contract, with real Codex and Claude Code adapters
  (each including a real `setup()` that transfers a local session/token to
  a GitHub Actions secret) and a placeholder interface for future
  providers;
- a scheduler package that computes primer run times from a work-start
  configuration, including recurring daily "dead-time" windows like lunch
  or meetings (see below), plus placeholder shared code;
- GitHub Actions workflow templates that run the Codex and Claude Code
  primers on a schedule, including hosted (GitHub App) variants (see
  below); and
- a hosted web UI (`apps/web`) with GitHub sign-in, a dashboard that
  provisions a private warmup repository, and a warmup-schedule settings
  page (see "Hosted setup (GitHub App)" below).

### Codex provider

`primetime prime codex` runs one minimal, sandboxed request through the
official Codex CLI to start your existing Codex/ChatGPT usage window. It
never handles credentials itself and never authenticates on your behalf.

Prerequisites:

- The official Codex CLI must be installed and on `PATH`.
- You must already be logged in via a supported **non-API** method (for
  example `codex login`, which uses ChatGPT sign-in, a Codex access token,
  or workload identity). API-key logins (`OPENAI_API_KEY` / `CODEX_API_KEY`)
  are explicitly rejected, because they bill per request instead of
  consuming a subscription usage window.

What the primer request does:

- Runs `codex exec` with `--ephemeral --sandbox read-only
  --skip-git-repo-check --ignore-user-config --ignore-rules`, from inside a
  freshly created, empty OS temporary directory that is deleted immediately
  afterward — the request never runs inside this repository or any other
  user directory, and never touches your files.
- Sends a single fixed prompt (`Reply only with OK. Do not use tools or
  inspect files.`) and nothing else. It does not inspect files, perform
  coding work, or modify anything.
- Strips `OPENAI_API_KEY` and `CODEX_API_KEY` from the child process
  environment so API billing can never be selected accidentally.
- Never includes captured CLI output, environment values, or file paths in
  its result — failures are mapped to a small set of fixed, sanitized
  messages (`cli_unavailable`, `authentication_required`, `timeout`,
  `rate_limited`, `unknown_failure`).

#### GitHub Actions credential setup

`primetime prime codex` reads `codex login status`; it does not authenticate
Codex itself. Once you're logged in locally with a supported non-API method,
`CodexProvider.setup()` transfers that session to a GitHub Actions secret so a
scheduled workflow can run it unattended:

1. Run `codex login` locally (browser/ChatGPT sign-in, an access token, or
   workload identity — never an API key).
2. From inside a checkout of your PrimeTime-controlled GitHub repository,
   run `primetime setup codex`. It reads your local `$CODEX_HOME/auth.json`
   (defaults to `~/.codex/auth.json`) and pipes it directly to
   [`gh secret set CODEX_AUTH_JSON`](https://cli.github.com/manual/gh_secret_set),
   scoped to that repository. `gh` performs GitHub's required sealed-box
   encryption locally — PrimeTime implements no cryptography of its own, and
   the file's bytes go **directly from your machine to GitHub's API**, never
   through a PrimeTime backend. This requires the GitHub CLI (`gh`) to be
   installed and already authenticated (`gh auth login`).
3. Create a fine-grained GitHub PAT scoped to *only* that repository, with
   "Secrets: Read and write" permission and nothing else — GitHub gives no
   API to mint a PAT programmatically, so this step has to be done by hand
   in the GitHub UI. Then run
   `echo "$YOUR_PAT" | primetime setup github-secrets-pat` to store it as
   the `PRIMETIME_SECRETS_PAT` secret (read from stdin, never as a CLI
   argument, so it can't leak through process listings). The scheduled
   workflow needs this to write the refreshed Codex session back after
   each run, since GitHub's default `GITHUB_TOKEN` cannot manage
   repository secrets.

This is based on OpenAI's own documented pattern for maintaining a
ChatGPT-session `auth.json` in CI/CD (see
[Authentication](https://developers.openai.com/codex/auth) and
[Maintaining Codex account auth in CI/CD](https://developers.openai.com/codex/auth/ci-cd-auth)),
which comes with real constraints a GitHub Actions workflow built on this
must respect:

- **Treat `auth.json` as a password.** Never commit it, log it, or use this
  pattern for a public/open-source repository.
- **The workflow must persist the file it gets back**, not just the one it
  started with. Codex automatically refreshes the session in place during a
  run; overwriting a runner's `auth.json` from the original secret on every
  run (instead of writing the refreshed copy back) destroys that refresh and
  eventually breaks the session.
- **One `auth.json` per runner / serialized workflow.** Don't share it across
  concurrent jobs.
- Codex refreshes the session automatically if it's been about 8 days since
  the last refresh — a daily or weekly scheduled primer keeps it alive
  indefinitely on its own. If the underlying credential is ever actually
  revoked, refreshing fails and re-running `setup()` (after `codex login`
  again locally) is required.

[`templates/github-actions/codex-prime.yml`](templates/github-actions/codex-prime.yml)
is the actual scheduled workflow: it restores `auth.json` from
`CODEX_AUTH_JSON`, runs the primer, and — using `PRIMETIME_SECRETS_PAT` —
persists the refreshed session by running `primetime setup codex` again,
this time from inside the runner. See that file's header comment for the
full copy-in instructions, and
[`templates/github-actions/README.md`](templates/github-actions/README.md)
for an overview.

#### Hosted setup (GitHub App)

The PAT step above is the one piece of the CLI-only flow that can't be
automated further — GitHub gives no API to mint a PAT programmatically, so
creating one is always a manual, hand-in-the-UI step. `packages/github-app`
and `apps/web` add a second, optional path that removes it, without
changing what PrimeTime's backend is allowed to touch: **it never receives,
stores, or logs a Codex/Claude/other provider session**, exactly as
`AGENTS.md` requires. Only GitHub-scoped, short-lived tokens ever pass
through it.

The mechanism has two parts:

1. **A GitHub App**, once installed on a user's repository, lets a backend
   mint short-lived (max 1 hour), narrowly-scoped installation access
   tokens on demand — no PAT, ever. `packages/github-app#mintInstallationToken`
   requests one scoped to exactly one repository and exactly the
   permissions needed (`{ secrets: "write" }`), even though the App's
   overall installed grant may be broader.
2. **GitHub Actions OIDC**: a workflow run can request a signed token from
   GitHub proving "I am run X of workflow Y in repository Z"
   (`$ACTIONS_ID_TOKEN_REQUEST_URL`, standard to every GitHub-hosted
   runner). `packages/github-app#verifyActionsOidcToken` verifies that
   token's signature against GitHub's own published JWKS
   (`https://token.actions.githubusercontent.com/.well-known/jwks`) and
   returns its claims. `apps/web`'s `/api/actions/token` route uses the
   verified `repository` claim to look up that repository's installation
   (tracked in Postgres from GitHub App webhook deliveries, via
   `apps/web/src/db/store.ts`) and, only if one exists, hands back an
   installation token scoped to just that repository. A repository with no
   matching installation gets nothing back — that lookup is the entire
   enforcement boundary.

The Codex session never enters this exchange at any point: the runner
already has it (restored from `CODEX_AUTH_JSON`, as above) before it asks
for a write-back token, and the token this exchange returns can only manage
that one repository's secrets, nothing else.

[`templates/github-actions/codex-prime-hosted.yml`](templates/github-actions/codex-prime-hosted.yml)
is the corresponding workflow template: identical to `codex-prime.yml`
except its write-back step performs the OIDC exchange instead of using
`PRIMETIME_SECRETS_PAT`, so only `CODEX_AUTH_JSON` is needed as a secret.
This is strictly additive — `codex-prime.yml` is unchanged and remains the
zero-backend, fully self-hostable path for anyone who doesn't want a hosted
backend in their trust chain at all.

`apps/web` also serves the web UI itself: a landing page explaining the
flow, "Sign in with GitHub" (the GitHub App's own user-to-server OAuth, used
only to identify the signed-in user for the dashboard — never a provider
credential), and a dashboard. The dashboard doesn't ask you to pick from
your existing repositories — it has one "Create my warmup repository"
button that installs the App if needed and connects a small private
`primetime-warmup` repository dedicated to this, in a single round trip
through GitHub. GitHub's API refuses to create a repository for any kind of
GitHub App token, so the backend only registers that repository's name;
it hands you a copy-paste command for your platform (with that
repository's name, this deployment's own URL, and your chosen provider(s)
already filled in). A provider picker on the dashboard lets you choose
Codex, Claude Code, or both — defaulting to both — before generating the
command, defaulting to a client-side-detected OS tab: macOS/Linux runs
[`scripts/setup-warmup-repo.sh`](scripts/setup-warmup-repo.sh), Windows
runs its PowerShell twin
[`scripts/setup-warmup-repo.ps1`](scripts/setup-warmup-repo.ps1) — both are
plain, readable scripts, reviewable before you run them, that check
prerequisites, log you into `gh`/each chosen provider only if you aren't
already, create the repository itself via `gh repo create` if it doesn't
exist yet, transfer each provider's session/token to its own secret, and
add each provider's scheduled workflow file, announcing each step as it
runs. A provider whose CLI isn't installed, or whose login/setup step
fails, is skipped with a warning rather than aborting the whole run — the
script only fails outright if none of your chosen providers end up
configured. If the dashboard has a saved warmup schedule (see below), the
generated command also carries it as a `--schedule-base64` flag, which the
scripts write to `.primetime/schedule.json` in the target repo — the file
each scheduled workflow's due-check step reads (see the Scheduler section
above), so the workflow never has to call back to `apps/web` at run time.

A "Warmup schedule" settings page on the dashboard lets you edit the time
zone, work-start time, lead time, active weekdays, and any recurring
dead-time windows that back that schedule, backed by the same
`@primetime/scheduler#parseScheduleConfig` validation as the CLI.

`apps/web/.env.example` documents the environment variables a real
deployment needs
(`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_BASE64`,
`GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_CLIENT_ID`,
`GITHUB_APP_CLIENT_SECRET`, `SESSION_SECRET`, `DATABASE_URL`,
`OIDC_AUDIENCE`) — names only, matching this project's rule against
committing real credential values.

The GitHub App must have **"Request user authorization (OAuth) during
installation"** enabled (so the same authorize screen both installs the App
for a first-time user and hands the backend a user access token) and a
matching **Callback URL** pointed at `<deployment-url>/api/auth/callback`.
Creating the warmup repository also requires the installation to cover
**"All repositories"** — GitHub's API for adding a single repository to an
existing installation only accepts a classic PAT, which this project
deliberately never asks users to create, so the dashboard surfaces an
actionable error rather than silently failing if a user picks "Only select
repositories" instead.

### Claude Code provider

`primetime prime claude-code` runs one minimal, sandboxed request through the
official Claude Code CLI to start your existing Claude subscription usage
window. It never handles credentials itself and never authenticates on your
behalf.

Prerequisites:

- The official Claude Code CLI (`claude`) must be installed and on `PATH`.
- You must already be logged in via a supported **non-API** method (for
  example `claude auth login` with a claude.ai account, or a
  `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`). API-key logins
  (`ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`) are explicitly rejected,
  because in Claude Code's non-interactive mode they are always used when
  present, billing per request instead of consuming a subscription usage
  window.

What the primer request does:

- Runs `claude -p "Reply only with OK. Do not use tools or inspect files."
  --disallowedTools "*" --permission-mode plan --permission-prompts none
  --max-turns 1 --output-format json --no-session-persistence`, from inside
  a freshly created, empty OS temporary directory that is deleted
  immediately afterward — the request never runs inside this repository or
  any other user directory, never touches your files, and (since Claude
  Code has no working-directory flag of its own) also keeps any
  project-level `CLAUDE.md` out of scope.
- Strips `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` from the child
  process environment so API billing can never be selected accidentally.
- Never includes captured CLI output, environment values, or the token
  itself in its result — failures are mapped to a small set of fixed,
  sanitized messages (`cli_unavailable`, `authentication_required`,
  `timeout`, `rate_limited`, `unknown_failure`), classified from the CLI's
  own structured `--output-format json` result rather than by matching raw
  text.

#### GitHub Actions credential setup

Unlike Codex's `$CODEX_HOME/auth.json`, Claude Code has no local session
file to transfer: `claude setup-token` generates a **one-year long-lived
OAuth token** and prints it to your terminal without ever writing it to
disk. That also means, unlike the Codex flow below, **no refresh/write-back
step is needed** — a scheduled workflow can reuse the same secret for its
full one-year lifetime.

1. Run `claude setup-token` locally. It opens a browser to authorize, then
   prints the token once — copy it.
2. From inside a checkout of your PrimeTime-controlled GitHub repository,
   run `echo "$THE_TOKEN" | primetime setup claude-code`. It reads the
   token from stdin (never a CLI argument, so it can't leak through process
   listings), verifies it actually authenticates before doing anything
   else, and pipes it directly to
   [`gh secret set CLAUDE_CODE_OAUTH_TOKEN`](https://cli.github.com/manual/gh_secret_set),
   scoped to that repository. `gh` performs GitHub's required sealed-box
   encryption locally — PrimeTime implements no cryptography of its own,
   and the token goes **directly from your machine to GitHub's API**, never
   through a PrimeTime backend. This requires the GitHub CLI (`gh`) to be
   installed and already authenticated (`gh auth login`).

[`templates/github-actions/claude-code-prime.yml`](templates/github-actions/claude-code-prime.yml)
is the actual scheduled workflow: it sets `CLAUDE_CODE_OAUTH_TOKEN` from the
secret above and runs the primer — see that file's header comment for the
full copy-in instructions, and
[`templates/github-actions/README.md`](templates/github-actions/README.md)
for an overview. Unlike Codex's two templates, there's no hosted/`-hosted`
variant: both of those exist only to offer two different ways to write a
refreshed Codex session back to its secret after each run, and Claude
Code's token needs no write-back at all — it's reused as-is for its full
one-year lifetime.

### Scheduler

`@primetime/scheduler` computes when a primer should run from a user's
work schedule:

```ts
import { computeNextPrimerRun, parseScheduleConfig } from "@primetime/scheduler";

const config = parseScheduleConfig({
  timeZone: "America/New_York",
  workStartTime: "09:00",
  leadTimeMinutes: 30,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  // Optional: recurring daily gaps (lunch, standing meetings, ...) that
  // get their own re-prime instant right before they end. Defaults to [].
  deadTimeWindows: [{ startTime: "12:00", endTime: "13:00" }],
});

computeNextPrimerRun(config, new Date());
```

`computeNextPrimerRun` returns the next absolute instant, strictly after
`now`, that is either `leadTimeMinutes` before `workStartTime`, or
`leadTimeMinutes` before the end of a `deadTimeWindows` entry, local to
`timeZone`, on the next date whose local weekday is in `activeWeekdays`.
It uses the JavaScript `Intl` API (no date library dependency) to convert
local wall-clock time to UTC, so it accounts for daylight-saving
transitions correctly on either side of the change. `parseScheduleConfig`
validates an untrusted input object (including that dead-time windows are
well-formed and don't overlap) and throws a descriptive
`InvalidScheduleConfigError` for anything malformed, rather than silently
falling back to a default.

The CLI exposes this through `primetime schedule next <config-path>`,
which reads a JSON file in the shape above and prints the next primer run
as an ISO instant:

```sh
node apps/cli/dist/src/bin.js schedule next ./schedule.json
# Next primer run: 2024-01-16T13:30:00.000Z
```

A second command, `primetime schedule due <config-path>
[--tolerance-minutes <n>] [--last-primed-at <iso-timestamp>]`, is the
actual decision point a scheduled GitHub Actions workflow polls on a
frequent, fixed cron cadence, since GitHub Actions' `schedule.cron` is
fixed-UTC and can't itself track an IANA time zone's DST shifts (or, with
dead-time windows configured, more than one trigger time per day). It
exits `0` when a primer is due right now, `2` when it isn't (an expected,
non-error outcome), and `1` for a real error. `--last-primed-at`, fed from
a persisted state file, lets it additionally catch up on an instant that a
dropped or delayed GitHub schedule tick already missed, as long as no
primer has succeeded since — see
[`templates/github-actions/README.md`](templates/github-actions/README.md)
for the full mechanism and why a fixed tolerance alone isn't enough.

This is exactly what the GitHub Actions workflow templates described
above (Codex and Claude Code, self-hosted and hosted) build on — see
[`templates/github-actions/README.md`](templates/github-actions/README.md)
for how the due-check, catch-up, and state-file steps fit together, and
the "Hosted setup (GitHub App)" section below for how the dashboard's
warmup-schedule settings page feeds a saved `ScheduleConfig` into a
warmup repository as `.primetime/schedule.json`.

## Development

```sh
npm install
npm run typecheck
npm test
```

After building, the current CLI can be exercised with:

```sh
node apps/cli/dist/src/bin.js prime codex
```

`apps/web` (the hosted backend, see "Hosted setup (GitHub App)" above) is a
Next.js app that isn't part of the `tsc -b`/`node --test` graph above — it
does its own type-checking and bundling, and needs `packages/github-app` and
`packages/shared` built first (via `npm run build` above):

```sh
npm run build -w apps/web    # next build
npm test -w apps/web         # tsx --test against every file in apps/web/test
```
