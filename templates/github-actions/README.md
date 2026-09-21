# GitHub Actions templates

Workflow templates never contain credentials and use only user-controlled
GitHub Actions secrets.

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
