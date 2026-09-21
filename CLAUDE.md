# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

PrimeTime is an early-stage open-source utility that schedules lightweight "primer" requests for AI coding tool CLIs (Claude Code, OpenAI Codex, Google Antigravity), so a provider's usage window starts before the user's normal coding session begins.

The intended end-to-end architecture is:

```
User → PrimeTime web UI → GitHub account / private PrimeTime repo → GitHub Actions → AI provider CLI
```

Provider credentials must always live in infrastructure the user controls (e.g. GitHub Actions secrets). **PrimeTime's backend must never receive, store, or log provider authentication material** (passwords, cookies, session tokens, API keys). This is an architectural constraint, not a style preference — see `AGENTS.md` for the full list of security invariants before touching anything related to auth, credential storage, or GitHub Actions workflow generation.

Currently implemented: a `primetime prime <provider>` CLI, the `ProviderAdapter` contract, and a real Codex adapter that runs one minimal, sandboxed `codex exec` request through the official Codex CLI (see the Codex provider section in the README for the exact safety flags and failure classification). `setup()` (interactive authentication) is intentionally left throwing "not implemented" — it does not read, transmit, or change credentials; authenticate directly with `codex login`. Scheduling, the web UI, and GitHub integration are not yet built.

## Commands

```sh
npm install
npm run typecheck   # tsc -b --pretty false (project references across all packages)
npm run build       # tsc -b
npm test            # builds, then runs node --test against compiled test files
```

Tests are plain `node:test` files compiled to JS; there is no test runner watch mode. To run a single test file after building:

```sh
node --test apps/cli/dist/test/arguments.test.js
```

To exercise the CLI directly after building:

```sh
node apps/cli/dist/src/bin.js prime codex
```

There is no lint script configured yet.

## Architecture

This is an npm workspaces monorepo (`apps/*`, `packages/*`) built with TypeScript project references (`tsconfig.json` at the root references each package; each package has its own `tsconfig.json` extending `tsconfig.base.json`). `tsconfig.base.json` enables strict mode plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — keep new code compliant rather than relaxing these.

- `apps/cli` — the `primetime` binary. `bin.ts` wires stdout/stderr into `index.ts#runCli`, which parses args (`arguments.ts`), resolves a provider via `@primetime/providers`, and prints the provider's own sanitized `PrimeResult.message` on both success and failure (never a raw/generic string, and never raw captured CLI output).
- `packages/providers` — the `ProviderAdapter` interface (`adapter.ts`: `detect`/`setup`/`validateAuthentication`/`prime`, plus the structured `PrimeResult` — `success`/`provider`/`durationMs`/`errorCategory`/`message`) and the provider registry (`registry.ts`, a lookup map keyed by lowercased provider id). Each provider lives in its own subdirectory and is added to the `providers` map in `registry.ts`. `UnknownProviderError` deliberately does not echo the invalid input back in its message (tested in `apps/cli/test/providers.test.ts`) — preserve that when editing.
  - `codex/` — the real Codex adapter: `process-runner.ts` is an injectable, `cross-spawn`-based subprocess runner (constructor-injected into `CodexProvider`, defaulting to the real one — tests inject a fake runner instead of invoking the real CLI); `classification.ts` classifies `codex login status` / `codex exec` outcomes from **combined stdout+stderr** (the installed CLI writes some status text to stderr, not stdout — don't assume otherwise); `messages.ts` maps every failure to a fixed, sanitized string, never built from captured output; `command.ts`/`environment.ts`/`workspace.ts` build the exact `codex exec` safety flags, strip `OPENAI_API_KEY`/`CODEX_API_KEY` from the child env, and run each primer request inside a freshly created, always-deleted temp directory.
- `packages/scheduler` — placeholder; scheduling/timezone logic will land here.
- `packages/shared` — cross-package primitives, currently just `PrimeTimeError`, a typed error base class keyed by `FailureKind` (`authentication_expired`, `provider_unavailable`, `rate_limited`, `cli_unavailable`, `invalid_configuration`, `network_failure`, `not_implemented`, `unknown_failure`). New error types across the codebase should extend this and pick the closest `FailureKind` rather than inventing ad hoc error shapes.
- `templates/github-actions` — will hold generated workflow templates once provider priming is implemented; workflows must use only user-controlled secrets and never embed credentials.

Package import boundaries: `apps/cli` depends on `@primetime/providers` and `@primetime/shared`; `@primetime/providers` depends on `@primetime/shared`. Keep provider-specific logic out of `shared` and out of the CLI layer — new provider behavior belongs in its own subdirectory under `packages/providers/src/`.

## Working conventions specific to this repo

- Every provider operation that isn't implemented yet must throw a clear "not implemented" error (see `ProviderOperationNotImplementedError`) rather than silently no-op or fake success — this is load-bearing for the "never touches credentials" guarantee.
- Never log, echo, or include authentication material (or user-supplied values that might look like secrets) in error messages or output.
- When adding a new provider, isolate it behind the `ProviderAdapter` interface; do not assume auth, CLI behavior, or credential storage matches other providers.
- Don't assume tests/build/lint passed — actually run `npm run typecheck` / `npm test` and report real results.
