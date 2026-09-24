# Contributing to PrimeTime

Thanks for considering a contribution. PrimeTime is a security-sensitive
project by design — it exists specifically so that AI-provider credentials
never have to touch a hosted backend — so a couple of the rules below are
non-negotiable rather than style preferences.

## Read these first

- [`AGENTS.md`](AGENTS.md) — the project's architectural constraints and
  security invariants. If your change touches authentication, credential
  storage, or GitHub Actions workflow generation, this is load-bearing, not
  background reading.
- [`CLAUDE.md`](CLAUDE.md) — a detailed, up-to-date map of the codebase:
  what each package/app does, how they depend on each other, and the
  reasoning behind non-obvious decisions. It's the fastest way to find
  where a change belongs before you start writing code.
- [`README.md`](README.md) — the user-facing description of what's
  implemented today.

## The one rule that matters most

**PrimeTime's backend must never receive, store, or log provider
authentication material** (passwords, cookies, session tokens, API keys).
Credentials move directly from a user's machine to their own GitHub Actions
secrets (via `gh secret set`), never through `apps/web` or any other
PrimeTime-controlled service. If you're adding a new provider or touching
`packages/github`, `packages/github-app`, or anything under `setup()`,
re-read `AGENTS.md`'s "Security invariants" section before you start, and
again before you open your PR.

## Development setup

```sh
npm install
npm run typecheck   # tsc -b --pretty false, across all project references
npm run build       # tsc -b
npm test            # builds, then runs node --test against compiled test files
```

`apps/web` is a Next.js app and is intentionally **not** part of the root
`tsc -b`/`npm test` graph (Next.js does its own type-checking and
bundling). Build `packages/github-app`, `packages/scheduler`, and
`packages/shared` first (`npm run build` at the root), then:

```sh
npm run build -w apps/web    # next build
npm test -w apps/web         # tsx --test against every file in apps/web/test
npm run lint -w apps/web     # next lint (the only lint script in the repo)
```

There is no CI configured on this repository yet, so **run typecheck and
both test suites locally before opening a PR** — nothing else will catch a
regression for you.

## Coding conventions

- `tsconfig.base.json` enables TypeScript strict mode plus
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Keep new
  code compliant rather than relaxing these settings.
- Avoid `any` unless there's a documented reason.
- Keep provider-specific behavior isolated behind the `ProviderAdapter`
  interface (`packages/providers/src/adapter.ts`) — never assume a new
  provider's authentication, CLI behavior, or credential storage matches
  an existing one.
- Respect the package import boundaries documented in `CLAUDE.md`
  ("Architecture" section) — e.g. `apps/web` never imports
  `@primetime/providers`, since it never runs a provider adapter itself.
- Prefer dependency injection for anything that shells out or hits the
  network (a `SubprocessRunner`, a `GhRunner`, a `fetchImpl`, an
  `io.readInput()`), the same pattern used throughout the codebase — it's
  what lets tests avoid invoking real CLIs or making real network calls.
- Every provider operation that isn't implemented yet should throw a clear
  "not implemented" error (see `ProviderOperationNotImplementedError`)
  rather than silently no-op or fake success.
- New error types should extend `@primetime/shared`'s `PrimeTimeError` and
  pick the closest existing `FailureKind` rather than inventing an ad hoc
  error shape.
- Never log, echo, or include authentication material — or user-supplied
  values that might look like secrets — in error messages, commit
  messages, or output of any kind.
- `scripts/setup-warmup-repo.sh` and `scripts/setup-warmup-repo.ps1` are
  kept in behavioral lockstep on purpose; a change to one needs the
  equivalent change in the other.

## Adding a new provider

1. Create a new subdirectory under `packages/providers/src/<provider-id>/`.
2. Implement the `ProviderAdapter` interface (`detect` / `setup` /
   `validateAuthentication` / `prime`), returning the structured
   `PrimeResult` / `ProviderSetupResult` types — every outcome (success or
   failure) needs a sanitized, fixed `message`, never raw captured CLI
   output.
3. Register the provider in `packages/providers/src/registry.ts`.
4. Mirror the existing `codex/`/`claude-code/` adapters' shape where it
   makes sense (an injectable subprocess runner, a `classification.ts` that
   maps CLI output to failure kinds, a `messages.ts` with fixed-literal
   messages only) — but don't assume anything about that provider's actual
   auth flow, CLI flags, or failure modes without verifying against the
   real CLI.
5. Add the provider to `apps/web/lib/providers.ts#AVAILABLE_PROVIDERS` if
   it should show up in the dashboard's provider picker and the setup
   scripts, and add a matching GitHub Actions workflow template under
   `templates/github-actions/`.

## Testing

- Tests are plain `node:test` files compiled to JS; there's no watch mode.
  After building, run a single file directly, e.g.
  `node --test apps/cli/dist/test/arguments.test.js`.
- At minimum, cover: schedule/timezone/DST calculations, active-weekday
  logic, configuration parsing, provider adapter classification/behavior,
  and secret redaction — using injected fakes, never real credentials or
  real network/CLI calls.
- Any test that would require real provider credentials must be explicitly
  marked as a manual integration test, and never commit real credentials
  or recorded authentication payloads.

## Commit messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, etc.), optionally
scoped, e.g.:

```
fix(scheduler): stop isPrimerDue re-firing within tolerance after a catch-up
feat(web): make warmup schedule time zone a dropdown
docs: document smart warmup scheduling in CLAUDE.md
```

## Opening a pull request

- Keep PRs focused — avoid unrelated refactoring alongside a behavioral
  change.
- Update `README.md` and/or `CLAUDE.md` whenever setup steps or documented
  behavior change; stale docs are treated as part of the bug.
- Call out the security implications explicitly in your PR description if
  the change touches authentication, credential storage/transfer, or
  generated GitHub Actions workflow content.
- Confirm in the PR description that `npm run typecheck`, `npm test`, and
  (if `apps/web` changed) `npm test -w apps/web` all pass locally.

## Reporting bugs / requesting features

Open a [GitHub issue](https://github.com/RamiSmat/primetime/issues) with
enough detail to reproduce (for a bug) or the concrete use case (for a
feature). Existing labels include `bug`, `enhancement`, `documentation`,
`good first issue`, `help wanted`, and area labels (`area: scheduler`,
`area: web`, `area: providers`) — feel free to suggest one, a maintainer
will adjust if needed.
