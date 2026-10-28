# Contributing to ATSly

Thanks for helping. This guide covers setup, the conventions the code follows, and what a
pull request needs.

## Setup

Follow [Getting started](README.md#getting-started): Node.js 22, `npm install`, copy
`.env.example` to `.env.local` and set `AUTH_SECRET`, then run `npm run db:local` and
`npm run dev`. No OpenAI key is needed; the offline mock provider is used without one.

## Before you open a pull request

Run what CI runs:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:coverage
npm run build
npm run test:e2e        # needs npx playwright install chromium once
```

If you change a check in `src/lib/ats`, regenerate the scoring reference with
`npm run docs:scoring`. If you change a prompt or AI schema, bump `PROMPT_VERSION` in
`src/lib/ai/prompts.ts` and run `npm run eval:ai`.

## Conventions

- **Layers.** UI code never imports the database or AI layers; engines in `src/lib/parsing`,
  `ats`, `matching` and `taxonomy` stay pure (no I/O, no Next.js). ESLint enforces both. Pages
  and routes go through `src/lib/services`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Ownership.** Every repository method takes an `Owner` and scopes its query by it.
  Someone else's data must look exactly like data that doesn't exist (404).
- **Honesty.** The deterministic engine owns the score. Never suggest adding skills the user
  doesn't have; never show AI text that quotes the resume without verifying it.
- **Validation.** Validate every request body and query with Zod in `src/lib/validation`.
- **Logging.** Log ids, codes, counts and durations. Never log resume or job description text.
- **Design.** Use the tokens and components in [docs/DESIGN.md](docs/DESIGN.md); check new
  UI at 320px and with the keyboard, and keep axe clean.
- **Tests.** Engines need unit tests for pass, fail and not-applicable cases; routes need
  integration tests for validation, ownership and errors; user flows need an E2E test.

## Commits and pull requests

- Branch from `main`; one topic per branch.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org) with an area
  scope: `feat(matching): …`, `fix(parsing): …`, `docs: …`, `test: …`, `ci: …`.
- Pull request titles use the same format. Describe what changed and why, how you tested
  it, and include screenshots for UI changes.

## Reporting bugs and ideas

Use the issue templates. For anything that could be a security problem, don't open a
public issue; follow [SECURITY.md](SECURITY.md).
