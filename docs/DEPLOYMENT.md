# Deployment

How to run ATSly in production on Vercel with MongoDB Atlas, and what to check before and
after launch. The design behind these choices is in [PLANNING.md](PLANNING.md) §30.

## What you need

| Service                                        | Required | Used for                                                                                           |
| ---------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| [Vercel](https://vercel.com)                   | yes      | Hosting: Next.js pages, API routes and the scan pipeline                                           |
| [MongoDB Atlas](https://www.mongodb.com/atlas) | yes      | Accounts, resumes, scans, rate limits, AI cache                                                    |
| [OpenAI](https://platform.openai.com)          | no       | AI analysis. Without it, set `AI_PROVIDER=off` (or leave the mock, which is meant for development) |
| Google Cloud OAuth client                      | no       | "Continue with Google"                                                                             |

## 1. MongoDB Atlas

1. Create a cluster in the region closest to where Vercel will run the functions (for
   example AWS `us-east-1` with Vercel's `iad1`). M0 is enough to try ATSly; use a dedicated
   tier for real traffic, for backups and steady performance.
2. **Database Access:** create a user with the built-in role **readWrite** on the `atsly`
   database only, and a long generated password.
3. **Network Access:** Vercel's egress addresses change, so either allow `0.0.0.0/0` and
   rely on the strong credentials (rotate them every quarter), or use Vercel's Secure Compute
   or an Atlas private endpoint.
4. Copy the connection string and add the database name:
   `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/atsly?retryWrites=true&w=majority`.

Indexes, including the TTL indexes that delete guest data and expire rate-limit windows
and AI cache entries, are created by the app on its first connection.

## 2. Vercel project

1. **Import** the GitHub repository. Vercel detects Next.js; keep the default build
   command (`npm run build`) and output.
2. **Node.js version:** 22.x (Project Settings → Build and Deployment).
3. **Functions:** keep Fluid compute on (the default for new projects). Set the function
   region to match Atlas. The scan route declares `maxDuration = 60` because the analysis
   finishes after its response; your plan must allow 60-second functions.
4. **Environment variables** for Production (and Preview, with a separate database):

   | Variable                               | Value                                                                                              |
   | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_APP_URL`                  | `https://your-domain`                                                                              |
   | `MONGODB_URI`                          | The Atlas connection string from step 1                                                            |
   | `AUTH_SECRET`                          | 32+ random bytes: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
   | `AI_PROVIDER`                          | `openai` (or `off`)                                                                                |
   | `OPENAI_API_KEY`                       | Your key, if `AI_PROVIDER=openai`                                                                  |
   | `OPENAI_MODEL`                         | Optional; `gpt-4.1-mini` by default                                                                |
   | `AI_DAILY_BUDGET_USD`                  | The most AI may cost per day, for example `5`                                                      |
   | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Optional, for Google sign-in                                                                       |
   | `RATE_LIMIT_*`, `GUEST_RETENTION_DAYS` | Optional; the defaults suit a public launch                                                        |

   `AUTH_SECRET` signs sessions and guest cookies: changing it signs everyone out and makes
   existing guest reports unreachable. Never reuse it across environments.

5. **Analytics:** enable Web Analytics in the Vercel project. The app renders the
   cookieless analytics script only when running on Vercel; the privacy page describes it.
6. **Domain:** add your domain and let Vercel issue the certificate. HTTPS turns on HSTS and
   `upgrade-insecure-requests` in the Content Security Policy.

## 3. Google sign-in (optional)

In Google Cloud Console, create an OAuth client of type _Web application_ with the
authorized redirect URI `https://your-domain/api/auth/callback/google`, then set
`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. The button appears once both are set. Only
Google accounts with a verified email can sign in; they are linked to an existing account
with the same email.

## 4. OpenAI (optional)

Create a project key with a monthly limit in the OpenAI dashboard as a second safety net
beside `AI_DAILY_BUDGET_USD`. Before changing `OPENAI_MODEL`, run the evals against it:

```bash
OPENAI_API_KEY=… OPENAI_MODEL=… npm run eval:ai
```

Requests ask OpenAI not to store data (`store: false`), and resumes are sent without the
name, email or phone number.

## Security in production

- **Headers:** every response carries HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, a strict referrer policy and a permissions policy.
- **Content Security Policy:** pages that show personal data (scan, results, dashboard,
  settings, sign-in) get a fresh nonce per request and run only scripts carrying it; the
  static marketing pages use a base policy so they can stay prebuilt. Neither allows
  framing, plugins or third-party origins.
- **CSRF:** cross-site writes to the API are refused by the proxy.
- **Dependencies:** the production dependency tree has no known vulnerabilities at
  release. Dependabot proposes updates weekly, after a two-week cooldown.

## Monitoring

- **Logs:** the app writes one JSON line per event to the Vercel logs, with ids, codes and
  counts and never document text. Useful events: `scan.complete`, `scan.failed`,
  `request.error` (with the digest users see on error pages), `ai.task`,
  `ai.task_failed`, `ai.budget_reached`, `db.unavailable`, `config.missing`.
- **Uptime:** set the repository variable `PRODUCTION_URL` (Settings → Secrets and
  variables → Actions → Variables) to your URL. The _Uptime_ workflow then checks
  `/api/health` every 30 minutes, and a failure notifies the repository's watchers. Point an
  external monitor at the same URL if you need faster alerts.
- **Health:** `GET /api/health` returns `200` with `"db": "up"` and the deployed commit, or
  `503` when the database can't be reached.

## Launch checklist

Before launch:

- [ ] Atlas: dedicated database user (readWrite on `atsly` only), network access decided,
      backups on for paid tiers
- [ ] Vercel: Node 22, function region next to Atlas, every variable above set for
      Production, Preview pointing at a separate database
- [ ] `AUTH_SECRET` generated fresh for production and stored only in Vercel
- [ ] AI: `AI_PROVIDER` and the daily budget set; evals run for the chosen model
- [ ] Google sign-in redirect URI matches the production domain (if used)
- [ ] `main` protected: pull requests with passing CI required
- [ ] GitHub private vulnerability reporting turned on (Settings → Code security)

After the first production deploy:

- [ ] `GET /api/health` returns `200` with `"db": "up"`
- [ ] `curl -I https://your-domain/` shows the security headers; `curl -I …/scan` shows a
      `nonce-` in `script-src`
- [ ] Guest flow: upload a resume, analyze, open the report, paste a job description,
      re-scan, copy a recommendation
- [ ] Account flow: sign up from a guest report (the report moves to the account), sign out,
      sign in, see it on the dashboard, delete a report, delete all data, delete the account
- [ ] Google sign-in (if configured)
- [ ] Rate limits: a guest's fourth scan in a day is refused with the limit message
- [ ] Lighthouse on `/` and `/methodology` from your own machine
- [ ] `PRODUCTION_URL` set, and the Uptime workflow run once by hand from the Actions tab
- [ ] Tag the release: `git tag v1.0.0 && git push origin v1.0.0`
