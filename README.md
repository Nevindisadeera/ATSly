# ATSly

Upload your resume, see how applicant tracking systems may read it, measure how well it matches a target role, and get clear, actionable improvements.

> **Status:** early development. The product and technical plan is in [`docs/PLANNING.md`](docs/PLANNING.md).

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Zod · Vitest · Playwright

## Getting started

Requires Node.js 20.19 or later.

```bash
npm install
cp .env.example .env.local   # then set AUTH_SECRET (the file explains how)
npm run db:local             # terminal 1: local MongoDB, no install needed
npm run dev                  # terminal 2
```

Open http://localhost:3000.

`npm run db:local` keeps its data in `.data/mongo`. If you already run MongoDB on port 27017,
or use MongoDB Atlas, point `MONGODB_URI` at it instead.

## Scripts

| Script                            | Purpose                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| `npm run db:local`                | Local MongoDB for development (data in `.data/mongo`)                     |
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
