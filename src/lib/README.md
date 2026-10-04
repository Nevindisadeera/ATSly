# `src/lib`

Server-side application code, organized by layer. React components never contain business logic; they receive computed view models from here. See `docs/PLANNING.md` §14–15.

| Folder        | Layer                                                                | Introduced in |
| ------------- | -------------------------------------------------------------------- | ------------- |
| `config/`     | Environment and limits                                               | Phase 1       |
| `parsing/`    | Domain engine: PDF/DOCX extraction and resume parsing (pure, no I/O) | Phase 5a      |
| `taxonomy/`   | Skills, aliases, lexicons (static data)                              | Phase 5a      |
| `db/`         | Mongoose connection, models, repositories                            | Phase 6       |
| `security/`   | Rate limiting, file signatures, origin checks                        | Phase 4b      |
| `http/`       | Response envelope, typed errors, request ids                         | Phase 4b      |
| `validation/` | Zod request schemas                                                  | Phase 4b      |
| `ats/`        | Domain engine: ATS checks and scoring (pure, no I/O)                 | Phase 7a      |
| `services/`   | Application services: orchestration and authorization                | Phase 6       |
| `matching/`   | Domain engine: job matching (pure, no I/O)                           | Phase 9a      |
| `ai/`         | OpenAI adapter, prompts, schemas, evidence verification              | Phase 10a     |
| `auth/`       | Auth.js configuration, guest identity, ownership                     | Phase 6 / 11a |
| `logging/`    | Structured logger                                                    | Phase 4b      |

Import rules are enforced in `eslint.config.mjs`:

- `src/components/**` must not import `@/lib/db` or `@/lib/ai`.
- `src/lib/{parsing,ats,matching,taxonomy}/**` must not import `@/lib/db`, `@/lib/ai`, `@/lib/services`, or `next/*`.
