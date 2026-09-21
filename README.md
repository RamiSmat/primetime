# PrimeTime

PrimeTime is an early-stage utility for scheduling lightweight primer requests
for AI coding tools. Provider credentials must remain on user-controlled
infrastructure and must never pass through a PrimeTime backend.

## Current scope

This repository currently contains a minimal TypeScript monorepo with:

- a `primetime prime <provider>` CLI skeleton;
- a provider adapter contract and placeholder Codex adapter;
- package placeholders for scheduling and shared code; and
- a placeholder directory for future GitHub Actions templates.

The Codex adapter does not yet authenticate or send primer requests. Running
`primetime prime codex` exits with a clear not-implemented error and does not
read, transmit, or change credentials.

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
