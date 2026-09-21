# PrimeTime

PrimeTime is an early-stage utility for scheduling lightweight primer requests
for AI coding tools. Provider credentials must remain on user-controlled
infrastructure and must never pass through a PrimeTime backend.

## Current scope

This repository currently contains a minimal TypeScript monorepo with:

- a `primetime prime <provider>` and `primetime schedule next <config-path>`
  CLI skeleton;
- a provider adapter contract and placeholder Codex adapter;
- a scheduler package that computes primer run times from a work-start
  configuration (see below), plus placeholder shared code; and
- a placeholder directory for future GitHub Actions templates.

The Codex adapter does not yet authenticate or send primer requests. Running
`primetime prime codex` exits with a clear not-implemented error and does not
read, transmit, or change credentials.

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
