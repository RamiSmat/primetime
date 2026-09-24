# GitHub Actions templates

Workflow templates never contain credentials and use only user-controlled
GitHub Actions secrets.

## Scheduling: frequent cron + a due-check step

All three templates below use the same scheduling mechanism. GitHub Actions'
`schedule.cron` is fixed-UTC and can't itself track an IANA time zone's DST
shifts or (once dead-time windows are configured) more than one trigger time
per day, so none of these templates try to compute a single precise `cron:`
line. Instead, each one:

1. Triggers on a tight, fixed cadence every 15 minutes, all day, every day,
   offset away from cron's round marks (`cron: "7,22,37,52 * * * *"` rather
   than `"*/15 * * * *"` — see the reliability note below for why) — this
   intentionally doesn't try to narrow itself to any particular time-zone
   band.
2. Checks out the repository the workflow itself lives in (in addition to
   PrimeTime's own source, checked out separately for building the CLI) so
   it has access to a `.primetime/schedule.json` file at the repo root —
   added by the PrimeTime dashboard's "Create my warmup repository" setup
   command, alongside the workflow file itself.
3. Reads that provider's own `.primetime/state-<provider>.json` (e.g.
   `state-codex.json`), if one exists from a prior run, for its
   `lastPrimedAt` timestamp — see the reliability note below.
4. Runs `primetime schedule due .primetime/schedule.json --tolerance-minutes
   20 [--last-primed-at <timestamp>]` as its first real step. This is the
   timezone/DST-aware decision point: it exits `0` when a primer is actually
   due right now, `2` when it isn't (an expected, non-error outcome), or `1`
   for a real error (e.g. a missing or invalid config file — this surfaces
   loudly rather than silently skipping or always running).
5. Gates every subsequent step on that step's `due` output, so a "not due"
   tick costs one cheap CLI invocation and skips the rest of the job.
6. On a successful primer, writes the current timestamp to
   `.primetime/state-<provider>.json` and commits it back to the repo with
   the default `GITHUB_TOKEN` (each template's `permissions.contents` is
   `write` for exactly this; each provider gets its own state file so one
   provider's primer can never make another provider's due-check think it's
   already been served).

If `.primetime/schedule.json` is missing, the due-check step fails the job
(exit `1`) rather than guessing — that almost always means the warmup
repo's setup command hasn't finished, and should be visible in the Actions
tab rather than silently never priming (or always priming).

**GitHub's `schedule` trigger is best-effort, not guaranteed — and this
project has observed it dropping ticks for hours at a time**, not just
delaying them by a few minutes. GitHub's own docs only officially warn about
delay, concentrated right at cron's round marks (`:00`/`:15`/`:30`/`:45`), so
all three templates fire off those marks instead. But since each schedule
config only produces one narrow due-instant per event (work-start, or each
dead-time window's end), a single dropped tick during that window — however
briefly GitHub's own docs suggest that should be possible — would otherwise
mean the whole day's primer for that event silently doesn't run, with
nothing in the Actions log to say so. Two independent layers guard against
that:

- `--tolerance-minutes 20` (wider than the CLI's own 8-minute default)
  widens the window a single tick has to land in.
- `--last-primed-at`, fed from each provider's persisted state file (steps 3
  and 6 above), gives every later tick the same day an unbounded catch-up
  window: as long as no primer has succeeded since the missed instant, the
  very next tick that does fire — even hours late — still runs it. This is
  what actually closes the gap a fixed tolerance can't: it doesn't matter
  how long GitHub's scheduler stays silent, only that it eventually sends
  one more tick before the next instant is due.

The state file also does double duty as a re-fire guard: once
`lastPrimedAt` is at or after an instant, `isPrimerDue` skips that instant
entirely, even for a later tick that still lands inside the 20-minute
tolerance window. Without that, a 15-minute cadence against a 20-minute-wide
window would otherwise re-run the primer two or three times for the same
instant.

If primers are still missing after this, check the workflow's Actions run
history for gaps of many hours with no runs at all — that points at GitHub's
scheduler itself outright refusing to trigger the workflow, which no amount
of due-check tuning inside the job can work around.

## `codex-prime.yml`

Runs `primetime prime codex` on a schedule, using a Codex session transferred
from your local machine (see the root README's "GitHub Actions credential
setup" section for why this works the way it does). The file itself has the
full setup instructions in its header comment — copy it into
`.github/workflows/` in your own PrimeTime-controlled repository and follow
them before enabling the schedule.

Requires two repository secrets, both set from your local machine via the
`primetime` CLI, never through a PrimeTime backend:

- `CODEX_AUTH_JSON` — your local Codex session (`primetime setup codex`).
- `PRIMETIME_SECRETS_PAT` — a fine-grained PAT scoped to only this
  repository's "Secrets: Read and write" permission, which the workflow
  needs to write the refreshed session back after each run
  (`primetime setup github-secrets-pat`, reading the PAT from stdin).

This template is provisional: PrimeTime isn't published as an installable
package yet, so it checks out and builds this repository's source directly
on the runner rather than installing a released version.

## `codex-prime-hosted.yml`

Same primer flow as `codex-prime.yml`, but the write-back step is replaced
with a GitHub Actions OIDC exchange against a hosted PrimeTime backend
instead of a hand-created `PRIMETIME_SECRETS_PAT`. See the root README's
"Hosted setup (GitHub App)" section for how the exchange works and what it
does and doesn't trust the backend with — in short, the Codex session itself
never passes through it, only a short-lived, repository-scoped token used
solely to write the refreshed session back.

Requires only one repository secret (`CODEX_AUTH_JSON`, same as above) plus
the PrimeTime GitHub App installed on this repository. The file's header
comment has the full setup instructions, including the placeholder
`PRIMETIME_WEB_URL`/`OIDC_AUDIENCE` values you must replace with your actual
deployment's.

Use `codex-prime.yml` instead if you don't want a hosted backend in your
trust chain at all — it remains fully self-contained.

## `claude-code-prime.yml`

Runs `primetime prime claude-code` on a schedule, using a Claude Code
session token transferred from your local machine (see the root README's
"GitHub Actions credential setup" section under "Claude Code provider" for
why this works the way it does). The file itself has the full setup
instructions in its header comment.

Requires only one repository secret, set from your local machine via the
`primetime` CLI, never through a PrimeTime backend:

- `CLAUDE_CODE_OAUTH_TOKEN` — a one-year long-lived token from
  `claude setup-token` (`primetime setup claude-code`, reading the token
  from stdin).

Unlike the two Codex templates above, there's no self-hosted/hosted split
here and no `-hosted` variant: those two variants exist only to offer two
different ways to write a refreshed Codex session back to the secret after
each run, and Claude Code's token needs no such write-back — it's reused
as-is for its full one-year lifetime.

This template is provisional in the same way as the Codex ones: PrimeTime
isn't published as an installable package yet, so it checks out and builds
this repository's source directly on the runner rather than installing a
released version.
