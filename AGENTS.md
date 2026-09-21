## Project overview

PrimeTime is an open-source developer utility that lets users schedule lightweight
"primer" requests for AI coding tools such as Claude Code, OpenAI Codex, and
Google Antigravity.

The purpose is to let users intentionally start their provider usage window
before their normal coding session begins.

The product must prioritize security and user trust.

PrimeTime must never require users to give PrimeTime's hosted infrastructure
their Claude, OpenAI, Google, or other AI-provider credentials.

The intended architecture is:

User
→ PrimeTime web UI
→ GitHub account / private PrimeTime repository
→ GitHub Actions
→ AI provider CLI

Provider credentials must remain under infrastructure controlled by the user,
such as GitHub Actions secrets.

PrimeTime's backend must never store provider authentication tokens.

---

## Core product principles

1. Security and trust come before convenience.
2. Never send provider credentials through PrimeTime's backend.
3. Never ask users to paste browser cookies or session tokens into the web app.
4. Prefer official authentication mechanisms from each provider.
5. Keep the setup process as simple as possible.
6. The user's computer should not need to remain powered on after initial setup.
7. The project should remain easy to self-host.
8. Avoid unnecessary infrastructure.
9. Keep provider integrations isolated behind common interfaces.
10. Do not introduce dependencies unless they provide clear value.

---

## Intended user flow

The expected user experience is:

1. User opens PrimeTime.
2. User signs in with GitHub.
3. User selects providers:
   - Claude Code
   - OpenAI Codex
   - Google Antigravity
4. User configures:
   - timezone
   - normal work start time
   - how long before work PrimeTime should run
   - active weekdays
5. User runs a one-time local setup command if required:
   
   `npx primetime setup`

6. The local setup tool detects or initiates provider authentication locally.
7. Authentication material is transferred directly to the user's own GitHub
   Actions secrets where technically possible.
8. PrimeTime's servers never receive provider credentials.
9. GitHub Actions runs the primer automatically on schedule.
10. PrimeTime shows status such as:
    - scheduled
    - success
    - failed
    - authentication expired

---

## Architecture

Prefer a monorepo structure similar to:

```text
primetime/
├── apps/
│   ├── web/
│   └── cli/
├── packages/
│   ├── providers/
│   ├── github/
│   ├── scheduler/
│   ├── config/
│   └── shared/
├── templates/
│   └── github-actions/
├── docs/
├── AGENTS.md
└── README.md

## Security invariants

Security requirements are architectural constraints, not optional guidelines.

PrimeTime must never:

- receive provider passwords
- receive browser cookies
- receive provider session tokens through the PrimeTime backend
- store Claude, OpenAI, Google, or other AI-provider credentials
- log authentication material
- expose credentials through analytics, telemetry, errors, or debugging output
- commit authentication material to Git
- include credentials in generated workflow files

Prefer credential flows where authentication material moves directly:

User machine
→ GitHub Secrets

Never:

User machine
→ PrimeTime backend
→ GitHub Secrets

If a provider cannot support this security model safely, document the limitation
instead of introducing an insecure workaround.

API credentials and subscription authentication are not interchangeable.

For example, an API key that consumes API billing must not be presented as a way
to trigger a user's subscription usage window unless this has been explicitly
verified.


## Provider architecture

Provider-specific behavior must be isolated behind adapters.

Conceptually:

```ts
interface ProviderAdapter {
  id: string;
  name: string;

  detect(): Promise<ProviderDetectionResult>;
  setup(): Promise<ProviderSetupResult>;
  validateAuthentication(): Promise<AuthValidationResult>;
  prime(): Promise<PrimeResult>;
}

Keep implementations separate:

packages/providers/
├── claude/
├── codex/
└── antigravity/

Do not assume authentication, quota behavior, CLI behavior, or credential storage
is identical across providers.

Prefer official provider CLIs and authentication mechanisms.

## GitHub Actions rules

Generated GitHub Actions workflows must:

use minimal permissions
support scheduled execution
support workflow_dispatch for manual testing
use short timeouts
avoid unnecessary repository checkout
never print secrets
avoid executing arbitrary user-controlled code
pin third-party actions where practical
fail clearly when authentication expires

The expected runner lifecycle is:

GitHub runner starts
→ required provider CLI is installed
→ provider authentication is restored
→ one minimal primer request is sent
→ result is reported
→ runner exits

PrimeTime must not give AI provider CLIs access to unrelated user repositories.

## Primer behavior

A scheduled primer exists only to initiate the provider usage window.

Primer requests must:

be as small as reasonably possible
not perform coding work
not inspect user files
not modify repositories
not invoke tools unnecessarily
not send repository contents to providers

A suitable primer prompt is equivalent to:

Reply only with OK.

## Engineering conventions
Use TypeScript strict mode.
Avoid any unless there is a documented reason.
Prefer explicit types at external/system boundaries.
Keep modules small and focused.
Separate provider-specific code from shared logic.
Prefer pure functions for scheduling and timezone calculations.
Do not introduce dependencies unless they provide clear value.
Reuse existing components before creating new abstractions.
Do not rewrite working code unnecessarily.
Do not change established architecture without explaining why.
Error handling

Classify expected failures where possible:

authentication expired
provider unavailable
rate limited
CLI unavailable
invalid configuration
network failure
unknown failure

Never include authentication material in errors.

User-facing errors should explain the next action the user should take.

Testing

At minimum, test:

work-start to primer-time calculations
timezone handling
daylight-saving behavior where applicable
active weekday calculations
schedule updates
configuration parsing
provider adapter behavior
secret redaction

Real-provider tests requiring credentials should be explicitly marked as manual
integration tests.

Never commit real credentials or recorded authentication payloads.

Before modifying code

Before implementing a task:

Inspect the existing repository.
Understand the current architecture.
Reuse existing components where possible.
Identify security implications.
Avoid unrelated refactoring.

For substantial changes, briefly describe the intended approach before editing.

Definition of done

A task is complete only when:

The requested behavior works.
Relevant type checks pass.
Relevant tests pass.
Linting passes where configured.
No credentials or secrets can leak through the change.
Existing behavior remains working unless intentionally changed.
Documentation is updated when setup or behavior changes.

Never claim tests, linting, or builds passed unless they were actually executed.