# Testing

How ATSly is tested, how to run each layer, and where things stand. The strategy follows
[PLANNING.md §26](PLANNING.md); this page records what exists.

## Layers

| Layer       | Tool                           | Where               | What it covers                                                                                                                                                                                     |
| ----------- | ------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                         | `tests/unit`        | ATS checks and scoring, parsing probes, job matching tiers and aggregation, AI verification and prompts, report view models, proxy rules, copy and client helpers                                  |
| Integration | Vitest + mongodb-memory-server | `tests/integration` | API routes end to end against a real MongoDB: uploads, scans and the pipeline, auth, ownership, paging, deletion cascades; fixture resumes and job descriptions through the engines                |
| End to end  | Playwright + axe-core          | `tests/e2e`         | The browser flows on desktop Chrome and a Pixel 7 profile: upload, results, job match, recommendations, sign-up and sign-in, dashboard and settings, keyboard use, accessibility and 320px layouts |
| AI evals    | Vitest                         | `tests/evals`       | Schema validity, evidence verification and recall for the AI tasks (`npm run eval:ai`)                                                                                                             |
| Lighthouse  | Lighthouse CI                  | `lighthouserc.json` | Accessibility, best practices, SEO and performance of the public pages                                                                                                                             |

## Running the tests

```bash
npm run test            # unit and integration tests
npm run test:coverage   # the same, with coverage thresholds (CI runs this)
npm run test:e2e        # Playwright; starts MongoDB and the dev server if they aren't running
npm run eval:ai         # AI evals with the mock provider; set OPENAI_API_KEY to evaluate a real model
```

Integration tests start a private in-memory MongoDB per file, so they need no setup. The
first run downloads the MongoDB binary (about 800 MB) into `node_modules/.cache`.

End-to-end tests run against whatever is on `http://localhost:3000`. Locally that is
`npm run dev` with `npm run db:local`; in CI it is a production build (`npm run start`)
against a MongoDB service. The AI provider is the deterministic mock, so no test ever calls
or pays for a real model.

## Coverage

Coverage is measured over `src/lib`, the code that decides scores, matches and access.
Thresholds are enforced in `vitest.config.mts` and fail CI when missed.

| Area                                                                  |                                       Lines covered |                Threshold |
| --------------------------------------------------------------------- | --------------------------------------------------: | -----------------------: |
| `ats` (scoring engine)                                                |                                              99.8 % |                     95 % |
| `matching` (job match engine)                                         |                                              99.2 % |                     95 % |
| `ai` (providers, verification, recommendations)                       |                                              97.3 % |                     90 % |
| `parsing` (PDF and DOCX extraction, section and entry parsing)        |                                              95.2 % |                     90 % |
| `services`, `db`, `security`, `auth`, `report`, `client` and the rest |                                            93–100 % |                        — |
| **All of `src/lib`**                                                  | **96.7 %** lines, 97.3 % functions, 85.2 % branches | 90 % lines and functions |

Three files are left out and covered by the E2E suite instead: the Auth.js configuration
and the Server Component owner lookup, which only run inside Next.js, and the XHR upload
client, which needs a browser for progress events. React components are covered by E2E,
not unit tests.

## End-to-end suite

88 tests, each run on desktop and mobile (176 runs; 15 are skipped by design where an
interaction only applies to one form factor):

- **Upload** (`scan-upload*.spec.ts`): every client and server error state, drag and drop,
  keyboard use, real PDF and DOCX fixtures.
- **Results** (`results.spec.ts`): full report, live progress, failure and retry, 404 and
  other people's reports, rate limits.
- **Job match** (`job-match.spec.ts`) and **recommendations** (`recommendations.spec.ts`):
  evidence popovers, filters, copy, AI degraded states, retrying with the same job.
- **Accounts** (`auth.spec.ts`): sign-up keeps the guest's report, sign-out and sign-in,
  field errors, redirects, keyboard-only sign-in.
- **Dashboard and settings** (`dashboard.spec.ts`): empty state, stats, the score trend by
  keyboard and as a table, paging, deleting a report, deleting all data and the account.
- **Marketing** (`marketing.spec.ts`): every public page, the 404 page, metadata routes.
- **Security** (`security.spec.ts`): security headers, a fresh CSP nonce per request on
  dynamic pages, and no CSP violations while scanning and signing in (production builds).

axe-core runs with no allowed violations on the landing, methodology, privacy, terms, scan,
results, login, register, dashboard, settings and 404 pages, and every main page is checked
for horizontal scrolling at 320px.

## Lighthouse

CI runs Lighthouse (mobile) on `/`, `/methodology`, `/scan` and `/login`. Accessibility of
at least 95 and best practices of at least 90 fail the build if missed, as does SEO below 90
on the public pages (`/scan` and `/login` are deliberately not indexed). Performance is
reported as a warning, because simulated throttling makes it noisy on shared runners.

Last local run against a production build, on a Windows development machine:

| Page           | Performance | Accessibility | Best practices |         SEO |
| -------------- | ----------: | ------------: | -------------: | ----------: |
| `/`            |       63–75 |           100 |            100 |         100 |
| `/methodology` |          90 |           100 |            100 |         100 |
| `/scan`        |          90 |           100 |            100 | not indexed |
| `/login`       |          78 |           100 |            100 | not indexed |

On `/` the cost is framework start-up (React and Next.js runtime, about 114 KB of the
173 KB of compressed JavaScript the page loads) under 4× CPU throttling; the page itself is
server-rendered with a small DOM (382 elements) and no layout shift. Production performance
is checked again on Vercel in Phase 15.

## Bundle review

Compressed JavaScript per page, from the same run:

| Page           | Scripts | JavaScript (compressed) |
| -------------- | ------: | ----------------------: |
| `/`            |      11 |                  173 KB |
| `/methodology` |      12 |                  184 KB |
| `/login`       |      14 |                  194 KB |
| `/scan`        |      17 |                  237 KB |

Nothing server-only reaches the browser: the engines, taxonomy and AI code run on the
server, and pages receive computed view models. The score trend chart is a small SVG
component rather than a charting library.

## Copy review

Every condition in PLANNING.md §24 has its message in the UI, checked against the copy deck
in Appendix B. Accounts brought one change: the report-not-found page now explains that
reports saved to an account open when you're logged in.
