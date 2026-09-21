# PrimeTime

PrimeTime is an early-stage utility for scheduling lightweight primer requests
for AI coding tools. Provider credentials must remain on user-controlled
infrastructure and must never pass through a PrimeTime backend.

## Current scope

This repository currently contains a minimal TypeScript monorepo with:

- a `primetime prime <provider>` and `primetime schedule next <config-path>`
  CLI;
- a provider adapter contract, with a real Codex adapter and a placeholder
  interface for future providers;
- a scheduler package that computes primer run times from a work-start
  configuration (see below), plus placeholder shared code; and
- a placeholder directory for future GitHub Actions templates.

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

`setup()` (interactively authenticating a provider) is intentionally not
implemented yet — authenticate directly with `codex login`.

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
});

computeNextPrimerRun(config, new Date());
```

`computeNextPrimerRun` returns the next absolute instant, strictly after
`now`, that is `leadTimeMinutes` before `workStartTime` local to
`timeZone`, on the next date whose local weekday is in `activeWeekdays`.
It uses the JavaScript `Intl` API (no date library dependency) to convert
local wall-clock time to UTC, so it accounts for daylight-saving
transitions correctly on either side of the change. `parseScheduleConfig`
validates an untrusted input object and throws a descriptive
`InvalidScheduleConfigError` for anything malformed, rather than silently
falling back to a default.

The CLI exposes this through `primetime schedule next <config-path>`,
which reads a JSON file in the shape above and prints the next primer run
as an ISO instant:

```sh
node apps/cli/dist/src/bin.js schedule next ./schedule.json
# Next primer run: 2024-01-16T13:30:00.000Z
```

It does not yet trigger `prime` itself on a schedule — that still requires
the GitHub Actions integration, which is not yet built.

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
