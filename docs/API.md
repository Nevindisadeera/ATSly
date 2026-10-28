# API

The HTTP API behind ATSly's pages. Every route lives under `/api`, runs on the Node.js
runtime and is implemented in `src/app/api`. Types for every response are in
[`src/types/api.ts`](../src/types/api.ts).

## Conventions

**Envelope.** Success responses are `{ "data": … }`. Failures are
`{ "error": { "code", "message", "details"? } }`, where `details.field` names the invalid
form field when there is one. Every response carries `X-Request-Id`; quote it when reporting
a problem.

**Who is calling.** A request belongs to the signed-in user (the Auth.js session cookie) or,
without a session, to the guest in the signed `atsly_gid` cookie. The first upload issues
that cookie. Resources owned by someone else return `404`, exactly like ids that don't
exist.

**Cross-site writes.** `POST`, `PUT`, `PATCH` and `DELETE` requests whose `Origin` or
`Sec-Fetch-Site` show another site are refused with `403 FORBIDDEN` before they reach a
route. Clients that send neither header, such as server-to-server calls, are not affected.

**Errors**

| Code                                                                     | Status | When                                                   |
| ------------------------------------------------------------------------ | -----: | ------------------------------------------------------ |
| `INVALID_INPUT`                                                          |    400 | Body or query failed validation                        |
| `UNAUTHENTICATED`                                                        |    401 | The route needs an account                             |
| `FORBIDDEN`                                                              |    403 | Cross-site write                                       |
| `NOT_FOUND`                                                              |    404 | Unknown id, or someone else's                          |
| `EMAIL_TAKEN`                                                            |    409 | Registering an email that has an account               |
| `FILE_TOO_LARGE`                                                         |    413 | Upload over 4 MB                                       |
| `UNSUPPORTED_TYPE`                                                       |    415 | Not a PDF or DOCX                                      |
| `EMPTY_DOCUMENT`, `ENCRYPTED_DOCUMENT`, `PARSE_FAILED`, `TOO_MANY_PAGES` |    422 | The file can't be used                                 |
| `RATE_LIMITED`                                                           |    429 | Limit reached; `Retry-After` gives the seconds to wait |
| `INTERNAL`                                                               |    500 | Unexpected failure                                     |
| `SERVICE_UNAVAILABLE`                                                    |    503 | The database can't be reached                          |

## Resumes

### `POST /api/resumes`

Multipart form with one `file` (PDF or DOCX, at most 4 MB and 10 pages). Uploads are
limited per network per hour.

`201` with the upload summary:

```json
{
  "data": {
    "id": "6ae1b495…",
    "fileName": "resume.pdf",
    "extension": "pdf",
    "sizeBytes": 48211,
    "pageCount": 1,
    "wordCount": 412,
    "sections": [{ "kind": "experience", "confidence": 1 }],
    "warnings": []
  }
}
```

Uploading the same file again returns the stored resume instead of parsing it twice.

### `GET /api/resumes/:id` · `DELETE /api/resumes/:id`

The resume with its parsed content (never the raw text), or `204` after deleting it and
every scan of it.

## Scans

### `POST /api/scans`

```json
{ "resumeId": "…", "jobDescription": { "text": "…", "title": "…", "company": "…" } }
```

`jobDescription` is optional (100–15,000 characters). To scan against a job description
the caller pasted before, send `"jobDescriptionId": "…"` instead; sending both is invalid.
Scans are limited per guest, per user and per network each day.

`202 { "data": { "scanId": "…" } }`. The analysis runs after the response.

### `GET /api/scans/:id/status`

```json
{
  "data": { "status": "running", "stage": "ai_analysis", "updatedAt": "…", "error": null }
}
```

`status` is `queued`, `running`, `complete` or `failed`; `stage` is `ats_rules`,
`job_matching`, `ai_analysis` or `finalizing`. Poll every 1.5 seconds, slowing to 3 seconds
after 20, and stop at `complete` or `failed`. A scan with no progress for 90 seconds fails
with `TIMEOUT`.

### `GET /api/scans/:id`

The scan with its full report once complete: `summary`, `ats` (score, band, categories with
every check), `match` (when a job description was given), `ai` (`status`, `skippedReason`,
`contentQuality`, `recommendations`) and the job and resume it belongs to.

### `GET /api/scans?limit=20&cursor=` (account)

The signed-in user's scans, newest first, as list items (scores and the top action, never
the report). `limit` is 1–50. Pass `nextCursor` back as `cursor` for the next page; it is
`null` on the last page. Guests get `401`.

### `DELETE /api/scans/:id`

`204`. The resume stays, so it can be scanned again.

### `DELETE /api/scans` (account)

Body `{ "confirm": "DELETE" }`. Deletes every scan, job description and resume in the
account and returns how many of each were removed:
`{ "data": { "scans": 3, "resumes": 1, "jobDescriptions": 1 } }`.

## Accounts

### `POST /api/auth/register`

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "at least 8 characters"
}
```

`201 { "data": { "id": "…" } }`, then sign in through Auth.js. Passwords are 8 characters
to 72 bytes. `409 EMAIL_TAKEN` when the email has an account. Sign-ups are limited per
network per hour.

### `/api/auth/*`

Auth.js endpoints for sign-in (`/api/auth/callback/credentials`, Google), the session
(`/api/auth/session`), CSRF and sign-out. Password sign-in is limited per email and per
network. Signing in moves the browser's guest data to the account.

### `DELETE /api/account` (account)

Body `{ "confirm": "DELETE" }`. Deletes the account and everything in it, then clears the
session cookie. `204`.

## Health

### `GET /api/health`

`{ "data": { "ok": true, "db": "up", "version": "0.1.0" } }`, or `503` with `"db": "down"`.
