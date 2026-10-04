# ATSly

Upload your resume, see how applicant tracking systems may read it, measure how well it matches a target role, and get clear, actionable improvements.

> **Status:** early development. The product and technical plan is in [`docs/PLANNING.md`](docs/PLANNING.md).

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Zod · Vitest · Playwright

## Getting started

Requires Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script                            | Purpose                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`                     | Start the development server                                              |
| `npm run build`                   | Production build                                                          |
| `npm run start`                   | Serve the production build                                                |
| `npm run typecheck`               | Generate route types and run the TypeScript compiler                      |
| `npm run lint`                    | ESLint, including layer-boundary rules                                    |
| `npm run format` / `format:check` | Prettier write / check                                                    |
| `npm run test`                    | Unit and integration tests (Vitest)                                       |
| `npm run test:e2e`                | End-to-end tests (Playwright; run `npx playwright install chromium` once) |

## License

MIT (license file added in a later phase).
