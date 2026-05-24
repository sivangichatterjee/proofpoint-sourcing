# Proofpoint Capital Sourcing Tool

A lightweight internal sourcing prototype for discovering, structuring, and reviewing Vertical AI companies against a fund-specific thesis.

This project was built for the Proofpoint Capital AI Intern exercise. The product is intentionally shaped around the requested workflow:

1. scan public information
2. surface candidate companies
3. generate structured profiles and thesis-fit analysis
4. let a human reviewer inspect, edit, and override
5. return everything to a searchable queue

The prototype favors clarity, speed, and analyst usability over breadth or overengineering.

## Live app

As a bonus, I also deployed the prototype on Vercel so it can be reviewed directly without any local setup.

Hosted app:

```txt
https://proofpoint-sourcing-vercel.vercel.app/
```

Demo video:

```txt
https://www.loom.com/share/02908a3f668242fa83b95c687f38d5fb
```

## What the app does

The app gives a Proofpoint team member a simple review loop:

- run a sourcing scan from a natural-language query
- watch scan progress live or let it continue in the background
- review surfaced companies in a central queue
- search, sort, filter, and resize queue columns
- open a company detail page with:
  - structured AI-generated company profile
  - source-backed signals
  - AI-generated thesis-fit score and rationale
  - manual workflow status
  - reviewer notes
  - next step
  - thesis comparison against a second model
- regenerate profile or thesis with reviewer guidance
- keep everything visible in the queue for follow-up

## Feature checklist against the assignment

This prototype covers the requested scope:

- Agent-led sourcing flow over public information
- Central queue / pipeline view
- Search, filter, and sort
- Structured company profile generation
- AI-generated thesis-fit reasoning and recommendation
- Workflow states:
  - `NEW`
  - `REVIEWING`
  - `PRIORITY_FOLLOW_UP`
  - `PASS`
- Human notes and next-step tracking
- Human override of AI output through:
  - regeneration with guidance
  - status changes
  - notes
  - thesis comparison selection

## Example reviewer flows to try

### Flow 1: Healthcare seed sourcing

Use this query:

```txt
AI healthcare startup raised seed Series A
```

Try:

1. Run a scan
2. Open one returned company
3. Review the profile and thesis
4. Add a note
5. Change status to `REVIEWING` or `PRIORITY_FOLLOW_UP`
6. Return to queue and verify the state persists

### Flow 2: Fintech sourcing

Use this query:

```txt
AI fintech startup raises funding
```

Try:

1. Run the scan
2. Use queue filters to isolate vertical and status
3. Inspect whether the surfaced company is truly workflow-specific or more horizontal
4. Compare the current thesis with the alternative model

### Flow 3: Human-in-the-loop thesis refinement

Open a company and use thesis regeneration guidance like:

```txt
be stricter about stage and fund fit
```

or

```txt
focus more on founder domain background
```

Then verify that:

- the regenerated thesis reflects the requested emphasis
- the recommendation still follows the score band
- the human reviewer can keep or override the updated view

## Product philosophy

This is not a generic startup-ranking app. It is an analyst workflow tool.

Three decisions shape the product:

### 1. Small-batch retrieval instead of exhaustive retrieval

The sourcing agent aims to find a small batch of usable companies, not flood the queue.

Current scan behavior:

- tries to get at least `3` companies
- can opportunistically return up to `5` if results are strong and fast
- has a soft time budget around `60s`
- has a hard stop around `120s`

That is deliberate. In this workflow, analyst attention is the scarce resource, not screen real estate.

### 2. Thesis score means fund fit, not just company quality

A company can be impressive and still be a weak fit for this fund.

The current thesis prompt is intentionally mandate-aware. It evaluates:

1. whether the company fits the encoded Proofpoint mandate
2. then how strong the company is within that mandate

This is why late-stage category leaders can still score low with a `PASS`.

### 3. Thesis-scoped instead of sector-agnostic

The prototype is intentionally optimized for the current Proofpoint thesis:

- healthcare
- life sciences
- financial services / fintech

That scope shows up in both retrieval and scoring. The goal here was not to build a general-purpose cross-sector discovery engine. It was to build a higher-trust workflow for the sectors the fund currently cares about most.

## Assumptions

To keep the prototype focused and high-signal, I made two explicit assumptions:

1. **The workflow is thesis-scoped**
   - retrieval, prompts, and evaluation are optimized for healthcare, life sciences, and fintech

2. **Review quality matters more than recall in v1**
   - a smaller set of usable candidates is more valuable than a larger noisy batch
   - a curated source pool improves trust, speed, and control even if it reduces breadth

## Thesis logic

The thesis prompt currently treats the fund as an early-stage Vertical AI investor and applies a hard stage gate before company-quality scoring.

At a high level, the model asks:

1. Is this in the right thesis universe?
   - healthcare
   - life sciences
   - financial services / fintech

2. Is it truly vertical AI?
   - workflow-specific
   - tied to industry-specific data, regulation, or operations
   - not just a horizontal model sold into a vertical

3. Is it a fit for the fund entry point?
   - the current prompt treats `Pre-seed` through `Series B` as the core window
   - clearly later-stage companies are penalized heavily

4. Within that, how strong is it?
   - founder domain credibility
   - technical wedge
   - traction
   - buyer clarity
   - defensibility

This logic lives in:

- [src/lib/thesis.ts](src/lib/thesis.ts)
- [src/lib/prompts.ts](src/lib/prompts.ts)

## Why this tech stack

### Why Next.js instead of FastAPI + separate frontend

I chose Next.js for the prototype because the assignment is fundamentally a workflow/UI problem as much as an API problem.

Why this was a good fit:

- one repo for frontend and backend
- route handlers for API endpoints without a separate service
- shared TypeScript types across UI, agent logic, and API layer
- simple deployment path to Vercel
- faster iteration for a prototype under time constraints

Why not FastAPI/Python for this version:

- it would have introduced a second runtime, second deployment path, and cross-stack contracts
- the hardest part of the assignment is not numerical modeling or heavy Python data tooling
- the app benefits a lot from tight UI/backend coupling

That said, FastAPI would be a strong option for a future version if the system evolved toward:

- background job orchestration
- heavier scraping / crawling
- asynchronous retrieval workers
- richer evaluation pipelines

### Why Prisma + SQLite / libSQL

For a prototype, this gave a very good balance of simplicity and portability.

- local development is easy with SQLite
- deployment can move to hosted libSQL via Turso
- schema stays explicit and easy to reason about
- no need to stand up Postgres just to satisfy the exercise

### Why Tavily for retrieval

The requirement explicitly calls for public information and lightweight inputs. Tavily was a practical way to:

- run web search without building custom scraping infra
- return URLs plus content snippets
- support query variation quickly

This was also a deliberate product choice. The prototype uses a **bounded retrieval layer**, not a fully open-ended web crawler. That kept the sourcing loop:

- fast enough for an interactive reviewer workflow
- cheaper to run
- easier to debug
- easier to explain when a reviewer asks why a company was surfaced

The tradeoff is lower breadth than a larger retrieval stack. If I were extending this beyond the prototype, I would likely move toward a hybrid retrieval system:

- broad search for first-pass discovery
- targeted crawling for validation and enrichment
- source-specific expansion for higher-value domains like funding news, launch posts, and company pages

### Why Together + OpenAI

I wanted:

- an open-model path for the main agent and generation loop
- a reliable comparison path for thesis evaluation

So the current setup is:

- Together for the main open-model path
- OpenAI for the secondary thesis comparison

That let me evaluate different calibration and reliability tradeoffs without building provider-specific code everywhere.

## Current model choices

### Primary model

Main generation tasks use:

```txt
meta-llama/Llama-3.3-70B-Instruct-Turbo
```

It is currently used for:

- relevance filtering
- profile generation
- thesis scoring
- combined company analysis
- agent planning

Why I chose it:

- strong enough for rubric-following and structured synthesis
- better stability than some of the other models I tested in this workflow
- practical latency for an interactive prototype

### Thesis comparison model

The comparison panel currently uses:

```txt
gpt-4o-mini
```

Why:

- fast
- reliable structured output
- gives a clean second opinion without adding too much latency or flaky formatting

I intentionally reduced the comparison panel to two models: the current thesis and one alternative thesis. A third model added more noise and latency than useful signal.

## Architecture overview

### Frontend

- [src/app/page.tsx](src/app/page.tsx)
  - queue view
  - top-level controls
- [src/components/queue-table.tsx](src/components/queue-table.tsx)
  - sortable columns
  - resizable columns
  - row navigation
- [src/components/run-scan-button.tsx](src/components/run-scan-button.tsx)
  - scan modal
  - SSE progress stream
  - background persistence across navigation
- [src/components/company-detail.tsx](src/components/company-detail.tsx)
  - profile view
  - thesis fit view
  - notes
  - next step
  - regeneration
  - thesis comparison
- [src/components/scan-banner.tsx](src/components/scan-banner.tsx)
  - persistent queue-updated banner after scan completion

### Backend / API routes

- [src/app/api/scan/route.ts](src/app/api/scan/route.ts)
  - triggers a scan
  - streams scan events via SSE
- [src/app/api/scan/status/route.ts](src/app/api/scan/status/route.ts)
  - scan status support
- [src/app/api/companies/[id]/profile/route.ts](src/app/api/companies/[id]/profile/route.ts)
  - regenerate structured profile
- [src/app/api/companies/[id]/thesis-fit/route.ts](src/app/api/companies/[id]/thesis-fit/route.ts)
  - regenerate thesis fit
- [src/app/api/companies/[id]/eval/route.ts](src/app/api/companies/[id]/eval/route.ts)
  - comparison thesis generation
- [src/app/api/companies/[id]/status/route.ts](src/app/api/companies/[id]/status/route.ts)
  - update workflow state
- [src/app/api/companies/[id]/notes/route.ts](src/app/api/companies/[id]/notes/route.ts)
  - notes handling
- [src/app/api/companies/[id]/route.ts](src/app/api/companies/[id]/route.ts)
  - company updates

### Core libraries

- [src/lib/agent.ts](src/lib/agent.ts)
  - sourcing loop
  - candidate filtering
  - dedupe
  - profile/thesis generation
  - stage and vertical enforcement
- [src/lib/llm.ts](src/lib/llm.ts)
  - provider routing
  - structured outputs
  - retry behavior
  - model fallback behavior
- [src/lib/queryConstraints.ts](src/lib/queryConstraints.ts)
  - parse natural-language scan queries into:
    - verticals
    - stages
    - geographies
    - focus terms
- [src/lib/stage.ts](src/lib/stage.ts)
  - stage extraction / normalization
- [src/lib/companyDedupe.ts](src/lib/companyDedupe.ts)
  - duplicate prevention
- [src/lib/db.ts](src/lib/db.ts)
  - database adapter setup
- [src/lib/tavily.ts](src/lib/tavily.ts)
  - Tavily search wrapper

## Data model

The schema lives in [prisma/schema.prisma](prisma/schema.prisma).

Core models:

- `Company`
  - queue entity
  - stores profile, thesis, status, source URL, stage, next step
- `Note`
  - reviewer notes on a company
- `ScanRun`
  - metadata about past scans
- `EvalPreference`
  - captures which thesis analysis a reviewer preferred in the comparison flow

Important implementation detail:

- `normalizedName` is used for dedupe so repeated scans do not keep re-surfacing the same company under minor naming variation

## Agent workflow

The sourcing loop is intentionally lightweight and readable.

### End-to-end flow

1. User enters a natural-language sourcing query
2. Query constraints are extracted
3. Agent planner chooses a search query
4. Tavily returns search results
5. Relevance filter decides which candidates are worth deeper analysis
6. The system generates:
   - structured company profile
   - thesis fit
7. Final hard checks enforce requested vertical and stage constraints before insertion
8. New companies are written to the queue
9. Reviewer opens a company, edits or regenerates as needed
10. Company remains in the queue with status, notes, and next action

### Why strict final checks exist

The app now enforces:

- requested vertical at final insertion time
- requested stage at final insertion time

This was added because otherwise the search layer could find something "close enough," but the final company shown in the queue could drift away from the user’s actual request.

## AI behaviors included

The assignment asked for at least two meaningful AI-powered behaviors. This prototype includes several:

1. **Relevance filtering**
   - decide whether a public result is actually worth processing

2. **Structured company profiling**
   - turn messy public text into a normalized company profile

3. **Thesis-fit scoring**
   - score and recommend a company against Proofpoint’s thesis

4. **Combined company analysis**
   - generate profile and thesis together in one call when possible

5. **Regeneration with analyst guidance**
   - allow human reviewers to focus the model on specific concerns

6. **Model comparison**
   - offer a second thesis opinion for human review

## Prompt design and context management

The prompts are written to be:

- explicit about schema
- explicit about mandate
- explicit about scoring bands
- strict about not inventing missing information

Key design choices:

- structured outputs instead of free-form generation
- thesis score tied to recommendation bands
- analyst guidance treated as a hard emphasis instruction during regeneration
- rationale must cite concrete signals

This keeps the outputs more reviewable and less "AI-ish."

## Error handling and fallback behavior

This was an important part of the exercise, so the app handles failure at a few levels.

### LLM calls

Handled in [src/lib/llm.ts](src/lib/llm.ts):

- provider routing by task
- retry on malformed structured output
- model-level fallback for some primary flows
- comparison route disables silent fallback on purpose, because a comparison card should not pretend to be a model it is not

### Agent flow

Handled in [src/lib/agent.ts](src/lib/agent.ts):

- duplicate companies are skipped
- invalid or irrelevant search results are skipped
- if combined company analysis fails, the agent falls back to separate profile and thesis calls
- if generation still fails, that candidate is skipped rather than inserted as broken data

### UI behavior

- scan can continue in background
- scan state is recoverable when the user returns to the queue
- completion feedback is surfaced both immediately and persistently
- empty states and partial-result scans are still visible to the reviewer

## Human-in-the-loop design

The reviewer can:

- change workflow state
- add notes
- set a next step
- regenerate profile with targeted guidance
- regenerate thesis with targeted guidance
- compare the current thesis with an alternative model
- keep the current thesis or adopt the alternative one

The app treats AI as a first-pass analyst assistant, not a final authority.

## Running the app

There are three practical ways to use this project:

1. open the hosted Vercel deployment
2. run it locally
3. deploy your own Vercel copy

### Option 2: Run locally

#### Requirements

- Node.js 20+
- npm

#### 1. Install dependencies

```bash
npm install
```

#### 2. Create your local environment file

Use `.env.local` for normal local development.

Suggested `.env.local`:

```env
DATABASE_URL=file:./dev.db
TAVILY_API_KEY=your_tavily_key
TOGETHER_API_KEY=your_together_key
OPENAI_API_KEY=your_openai_key
SCAN_MODE=live
```

Optional local Turso config instead of SQLite:

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

#### 3. Initialize the local database

For a fresh local database, run:

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

Important detail:

- the local SQLite database is `dev.db`
- not `prisma/dev.db`

#### 4. Start the app

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

#### 5. Optional: production-like local test

For a production-like local test:

```bash
npm run build
npm run start
```

Difference:

- `npm run dev` = development mode, hot reload, dev-only behavior
- `npm run start` = production mode, after a successful build

#### Optional: pull Vercel envs into a separate local file

I keep `.env.local` separate from Vercel-pulled envs.

For a separate local copy of the Vercel envs:

```bash
vercel env pull .env.vercel.local
```

That keeps:

- `.env.local` for your actual local workflow
- `.env.vercel.local` as a separate Vercel reference file

### Option 3: Deploy your own Vercel copy

#### Production database

Do not use local SQLite in production.

Use Turso / libSQL for hosted deployment.

The intended split is:

- SQLite for local development
- Turso for Vercel

#### 1. Add production environment variables in Vercel

Add these in the Vercel dashboard:

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
TAVILY_API_KEY=...
TOGETHER_API_KEY=...
OPENAI_API_KEY=...
SCAN_MODE=live
```

#### 2. Decide how to initialize production data

There are two clean options.

Option A: mirror your local seeded database

1. identify the real local SQLite file
2. upload that DB into Turso
3. connect Vercel to the Turso database

In this project, the real local DB is:

```txt
dev.db
```

If Turso requires WAL mode before upload:

```bash
sqlite3 dev.db "PRAGMA journal_mode=WAL;"
```

Option B: initialize Turso directly through Prisma

```bash
TURSO_DATABASE_URL="libsql://..." \
TURSO_AUTH_TOKEN="..." \
npx prisma db push
```

Then seed it:

```bash
TURSO_DATABASE_URL="libsql://..." \
TURSO_AUTH_TOKEN="..." \
npx prisma db seed
```

#### 3. Deploy

Once the repo and env vars are ready:

```bash
vercel --prod
```

You can also use Git-based auto deployment from the connected repo.

#### 4. Verify the deployed app

After deploy, verify:

- queue loads
- company detail pages load
- scan works
- profile regeneration works
- thesis regeneration works
- column resizing behaves correctly

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run test
```

## Tests

Current automated tests are intentionally focused on deterministic logic seams rather than trying to mock the entire LLM workflow.

Run:

```bash
npm run test
```

And typecheck with:

```bash
npx tsc --noEmit
```

Current tests cover:

- query constraint extraction
- stage detection
- duplicate normalization
- prompt contract expectations

Test files:

- [tests/query-constraints.test.ts](tests/query-constraints.test.ts)
- [tests/stage-and-dedupe.test.ts](tests/stage-and-dedupe.test.ts)
- [tests/prompts.test.ts](tests/prompts.test.ts)

### Manual QA checklist

Good manual checks:

1. run a live scan
2. leave the queue while scan is running, then return
3. confirm scan state resumes
4. inspect a surfaced company
5. regenerate profile with guidance
6. regenerate thesis with guidance
7. compare current thesis with the alternative model
8. change workflow state and add notes
9. return to queue and confirm persistence

## Key tradeoffs

### Why not maximize retrieval volume?

Because this is an analyst workflow, not a discovery firehose. A smaller, cleaner batch is easier to review and route, even at the cost of recall.

### Why not fully open-web crawling in v1?

Because the assignment called for a lightweight internal workflow using public information and simple source inputs, not a full retrieval-infrastructure buildout. Keeping retrieval bounded improved trust and explainability, while giving up breadth.

### Why Next.js instead of splitting frontend and backend?

Because for this assignment, a single full-stack codebase improved iteration speed and reduced glue code.

Tradeoff:

- simpler prototype
- less specialized than a larger Python + worker architecture

### Why only one alternative model in thesis comparison?

Because trust and speed were more important than model count. A third model introduced more latency and structured-output fragility than decision value.

### Why strict final vertical and stage checks?

Because users expect the queue to honor what they asked for. Silent drift to adjacent sectors or stages hurts trust, even if stricter checks reduce recall in narrow scans.

## What I would do next with more time

If I had more time, I would invest in four areas:

1. **Explicit separation of company quality vs fund fit**
   - right now thesis fit is a single score
   - I would likely split it into:
     - company quality
     - fund fit

2. **Better scan explainability**
   - clearer reasons for zero-result or low-result scans
   - better visibility into duplicates, skips, and broadened recovery mode

3. **Source-evidence validation**
   - tighten retrieval so companies are not admitted based only on broad vertical relevance
   - require stronger source support for stage-sensitive queries like `early stage`, `seed`, or `Series A`
   - distinguish discovery sources from validation sources, so ranking or profile articles can surface names without being treated as proof of funding stage

4. **Conditional source-pool broadening**
   - retrieval currently prioritizes a curated pool of startup, funding, fintech, healthcare, and life sciences sources to keep results higher-signal for the current thesis
   - with more time, I would selectively broaden that pool for unsupported or niche queries rather than jumping straight to unrestricted web search
   - that would preserve trust in the core workflow while improving coverage for adjacent sectors and less-covered sub-verticals

5. **Background job orchestration**
   - move long scans to durable workers rather than request-bound streaming
   - especially useful for larger or slower retrieval loops

6. **Higher-confidence evaluation set**
   - build a curated benchmark set of companies and expected statuses
   - use it to calibrate prompts and compare model behavior more systematically

## Final note

This prototype is meant to feel like a practical internal analyst tool, not a flashy AI demo. The decisions here were mostly about clarity, inspectability, overrideability, and trust.
