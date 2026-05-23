# Proofpoint Capital Sourcing Tool

An analyst-facing sourcing workflow for discovering, profiling, and scoring Vertical AI startups against Proofpoint Capital's investment thesis.

The app combines:
- an agentic web-sourcing loop
- structured company profile generation
- thesis-fit scoring against a fund-specific rubric
- human-in-the-loop editing and regeneration
- model comparison for thesis assessments

Built with Next.js App Router, React 19, Prisma + SQLite/libSQL, Together, OpenAI, and Tavily.

## What the product does

The tool is designed around an analyst workflow rather than a generic AI demo:

- `Run sourcing scan` searches the web for a narrow batch of high-signal companies per run, aiming for at least 3 and stretching to 5 when results are coming in quickly
- each company is profiled into a structured memo-like view with description, product summary, target customer, stage, and extracted signals
- the system assigns a `Thesis Fit` score and recommendation against Proofpoint's investment thesis
- analysts can edit notes, regenerate profile/thesis sections with guidance, and compare alternative thesis analyses from other models

Two product choices are intentional:

- The scan stops after a small batch of high-signal companies instead of maximizing recall. The goal is analyst throughput, not a giant noisy list.
- Thesis fit is a `fund-fit` score, not just a `company quality` score. Great late-stage companies can still score poorly if they are outside Proofpoint's entry window.

## Current thesis logic

The thesis prompt evaluates companies in two layers:

1. `Mandate gate`
   Proofpoint is treated as an early-stage fund with a core entry window of `Pre-seed` through `Series B`. `Series C+` or clearly late-stage companies are capped low even if they are strong businesses.

2. `Vertical AI quality`
   Within the mandate, the model looks for:
   - clear vertical focus in healthcare, life sciences, or financial services
   - vertical-specific workflow depth rather than a horizontal AI wrapper
   - domain-credible founders
   - a defensible technical wedge
   - traction such as paying customers, pilots, or named partners

This is encoded in [src/lib/thesis.ts](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/src/lib/thesis.ts) and [src/lib/prompts.ts](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/src/lib/prompts.ts).

## Architecture

### Frontend

- [src/app/page.tsx](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/src/app/page.tsx): sourcing queue
- [src/components/run-scan-button.tsx](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/src/components/run-scan-button.tsx): scan modal, SSE progress, background scan persistence
- [src/components/company-detail.tsx](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/src/components/company-detail.tsx): company profile, thesis fit, regeneration, notes, model comparison
- [src/components/scan-banner.tsx](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/src/components/scan-banner.tsx): background-scan completion banner

### Backend

- [src/app/api/scan/route.ts](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/src/app/api/scan/route.ts): starts the sourcing agent and streams progress events
- [src/lib/agent.ts](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/src/lib/agent.ts): search-plan loop, relevance filter, profile/thesis generation, dedupe, persistence
- [src/lib/llm.ts](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/src/lib/llm.ts): model routing, structured output calls, retry/fallback behavior
- [src/lib/queryConstraints.ts](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/src/lib/queryConstraints.ts): turns natural-language scans into vertical/stage/geography/focus constraints

### Data model

Prisma schema lives in [prisma/schema.prisma](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/prisma/schema.prisma).

Core tables:
- `Company`
- `Note`
- `ScanRun`
- `EvalPreference`

`normalizedName` is used to reduce duplicate companies across scans.

## Setup

### Requirements

- Node.js 20+
- npm

### Environment variables

Create `.env.local` with:

```bash
DATABASE_URL=...
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
TAVILY_API_KEY=...
TOGETHER_API_KEY=...
OPENAI_API_KEY=...
SCAN_MODE=live
```

Notes:
- For local development, `DATABASE_URL=file:./dev.db` is enough.
- For a hosted deployment, prefer `TURSO_DATABASE_URL` plus `TURSO_AUTH_TOKEN`. The app accepts either the Turso-style env pair or a plain `DATABASE_URL`.
- `SCAN_MODE=mock` uses [prisma/mock-scan-results.json](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/prisma/mock-scan-results.json)
- `SCAN_MODE=live` uses Tavily + LLMs
- `OPENAI_API_KEY` is needed for `gpt-4o-mini` model comparison

### Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Database

If you need a fresh local DB:

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run test
```

`npm install` also runs `prisma generate` via `postinstall`, which helps Vercel builds stay in sync with the Prisma schema.

## Testing

The test suite is intentionally lightweight and focused on business logic that is easy to regress:

- query constraint extraction
- stage detection
- duplicate-name normalization
- thesis prompt mandate guardrails

Tests live in:
- [tests/query-constraints.test.ts](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/tests/query-constraints.test.ts)
- [tests/stage-and-dedupe.test.ts](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/tests/stage-and-dedupe.test.ts)
- [tests/prompts.test.ts](/Users/sivangichatterjee/Desktop/proofpoint-sourcing/tests/prompts.test.ts)

Run them with:

```bash
npm run test
```

### Suggested manual QA

- run a live scan and confirm the agent returns at least 3 companies when possible, and can stretch up to 5 if it finds strong matches quickly
- close the scan modal mid-run and verify the scan continues in the background
- open a company, regenerate profile with analyst guidance, and confirm the saved profile changes
- regenerate thesis fit and verify the mandate gate penalizes `Series C+` companies
- open `Compare thesis analyses` and verify alternative models return structured, selectable results
- confirm duplicate companies do not reappear across repeated scans

## Deploying to Vercel

This app is Vercel-friendly, but there is one important caveat: do **not** deploy it with the local SQLite file. Vercel's filesystem is ephemeral, so production should use a hosted libSQL database such as Turso.

### Recommended production setup

1. Create a Turso database.
2. Get the database URL and auth token.
3. Add these environment variables in Vercel:

```bash
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
TAVILY_API_KEY=...
TOGETHER_API_KEY=...
OPENAI_API_KEY=...
SCAN_MODE=live
```

You can also set `DATABASE_URL`, but with the current codebase the Turso-specific pair is the cleanest production path.

### One-time database initialization

This repo does not yet have a checked-in migration history, so for the first production database setup do this locally against the remote Turso database:

```bash
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
npx prisma db push
npx prisma db seed
```

That creates the schema and seeds the initial queue data into the hosted database.

### Deploy steps

1. Push the repo to GitHub.
2. Import the repo into Vercel.
3. Add the environment variables above in the Vercel project.
4. Deploy.

Vercel should detect Next.js automatically. Because the repo now runs `prisma generate` in `postinstall`, you do not need a custom build command just to generate Prisma Client.

### After deploy

- Open the production URL
- Verify the queue loads from the hosted database
- Run a live scan
- Open a company detail page and confirm profile/thesis regeneration works

If deployment fails, the most likely causes are:
- missing environment variables
- trying to use local SQLite instead of a hosted libSQL database
- a production database that was never initialized with `prisma db push`

## Model setup

Current main thesis-generation path uses:
- `meta-llama/Llama-3.3-70B-Instruct-Turbo`

Current comparison panel uses:
- `gpt-4o-mini`

The Together call path uses structured outputs via `json_schema` when supported.

## Interview framing

If asked why the tool is built this way, the shortest accurate answer is:

`This is an analyst workflow optimizer, not a general company-ranking demo. The system first checks fund mandate, then evaluates thesis quality, and it returns a small batch of high-signal companies so the human reviewer can move quickly without being flooded with noisy candidates.`

Useful talking points:
- the thesis score is a `fund-fit` score, not just a company-quality score
- late-stage companies can still be excellent businesses but poor fits for this fund
- model comparison is there to compare analytical usefulness, not to pretend model outputs are ground truth
- the scan loop is deliberately capped to keep latency and review effort manageable

## Known limitations

- LLM calibration still varies by model, especially on borderline companies
- web search quality depends on the coverage and freshness of public sources
- structured output reliability is much better than before, but not perfect across all Together/OpenAI models
- the current tests cover the highest-value logic seams, not the full UI surface
