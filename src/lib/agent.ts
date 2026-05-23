import { readFileSync } from "fs";
import { join } from "path";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { tavilySearch } from "@/lib/tavily";
import type { TavilyResult } from "@/lib/tavily";
import { normalizeCompanyName } from "@/lib/companyDedupe";
import {
  RELEVANCE_FILTER_PROMPT,
  PROFILE_PROMPT,
  THESIS_FIT_PROMPT,
  COMPANY_ANALYSIS_PROMPT,
  AGENT_PLANNER_PROMPT,
} from "@/lib/prompts";
import {
  RelevanceFilterSchema,
  CompanyProfileSchema,
  ThesisFitSchema,
  CompanyAnalysisSchema,
  AgentPlannerSchema,
  normalizeSignals,
} from "@/lib/types";
import type { CompanyProfile, SignalItem, ThesisFit } from "@/lib/types";
import { detectStage, normalizeStageValue } from "@/lib/stage";
import { extractConstraints, stripConstraintNoise } from "@/lib/queryConstraints";

function mapToThesisVertical(tags: string[]): string | null {
  const allTags = tags.join(" ").toLowerCase();

  const hasHealthcareContext =
    allTags.includes("healthcare") ||
    allTags.includes("health") ||
    allTags.includes("clinical") ||
    allTags.includes("medical") ||
    allTags.includes("patient") ||
    allTags.includes("provider") ||
    allTags.includes("hospital") ||
    allTags.includes("payer") ||
    allTags.includes("ehr") ||
    allTags.includes("care");

  const hasHealthcareBillingContext =
    allTags.includes("revenue cycle") ||
    allTags.includes("rcm") ||
    allTags.includes("patient billing") ||
    allTags.includes("medical billing") ||
    allTags.includes("healthcare billing") ||
    allTags.includes("provider billing") ||
    allTags.includes("patient payments") ||
    allTags.includes("healthcare payments") ||
    allTags.includes("provider payments");

  if (
    allTags.includes("life sciences") ||
    allTags.includes("pharma") ||
    allTags.includes("biotech") ||
    allTags.includes("genomics") ||
    allTags.includes("drug discovery") ||
    allTags.includes("clinical trial") ||
    allTags.includes("pharmacovigilance") ||
    allTags.includes("pathology") ||
    allTags.includes("laboratory") ||
    allTags.includes("bioinformatics")
  ) {
    return "Life Sciences";
  }

  if (
    hasHealthcareBillingContext ||
    allTags.includes("healthcare") ||
    allTags.includes("health") ||
    allTags.includes("clinical") ||
    allTags.includes("medical") ||
    allTags.includes("patient") ||
    allTags.includes("hospital") ||
    allTags.includes("radiology") ||
    allTags.includes("imaging") ||
    allTags.includes("scribe") ||
    allTags.includes("ehr") ||
    allTags.includes("prior auth") ||
    allTags.includes("care") ||
    allTags.includes("diagnostic")
  ) {
    return "Healthcare";
  }

  if (
    allTags.includes("fintech") ||
    allTags.includes("insurance") ||
    allTags.includes("underwriting") ||
    allTags.includes("lending") ||
    allTags.includes("banking") ||
    allTags.includes("financial") ||
    (allTags.includes("payments") && !hasHealthcareContext) ||
    allTags.includes("wealth") ||
    allTags.includes("credit") ||
    allTags.includes("fraud") ||
    allTags.includes("compliance")
  ) {
    return "Fintech";
  }

  return null;
}

function matchesRequestedVertical(
  finalVertical: string | null,
  requestedVerticals: string[]
): boolean {
  if (requestedVerticals.length === 0) return true;
  if (!finalVertical) return false;

  const normalizedFinal = finalVertical.toLowerCase();
  return requestedVerticals.some(
    (vertical) => vertical.toLowerCase() === normalizedFinal
  );
}

const ORDERED_STAGES = [
  "Pre-seed",
  "Seed",
  "Series A",
  "Series B",
  "Series C",
  "Series D",
  "Series E",
  "Series F",
] as const;

function matchesRequestedStage(
  finalStage: string | null,
  requestedStages: string[],
  allowAdjacentBroadening = false
): boolean {
  if (requestedStages.length === 0) return true;
  if (!finalStage) return false;

  const normalizedFinal = finalStage.toLowerCase();
  const normalizedRequested = requestedStages.map((stage) => stage.toLowerCase());

  if (normalizedRequested.includes(normalizedFinal)) {
    return true;
  }

  if (!allowAdjacentBroadening) {
    return false;
  }

  const finalIndex = ORDERED_STAGES.findIndex(
    (stage) => stage.toLowerCase() === normalizedFinal
  );
  if (finalIndex === -1) {
    return false;
  }

  return ORDERED_STAGES.some((stage, index) => {
    if (!normalizedRequested.includes(stage.toLowerCase())) return false;
    return Math.abs(index - finalIndex) === 1;
  });
}

export type ScanProgressEvent =
  | {
      type: "constraints";
      verticals: string[];
      stages: string[];
      stageLabels: string[];
      geographies: string[];
      focusTerms: string[];
      timeLabel: string;
    }
  | { type: "iteration"; iteration: number; query: string; reasoning: string }
  | { type: "found"; company: string; vertical: string | null; stage: string | null; score: number | null }
  | { type: "skipped"; url: string; reason: string }
  | { type: "complete"; created: number; skipped: number; scanRunId: string }
  | { type: "error"; message: string };

function normalizeScanQuery(query: string): string {
  return stripConstraintNoise(query).replace(/\s+/g, " ").trim().toLowerCase();
}

async function wasQueryRunRecently(query: string, lookbackHours: number = 24): Promise<boolean> {
  const normalized = normalizeScanQuery(query);
  if (!normalized) return false;

  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const recentRuns = await db.scanRun.findMany({
    where: { createdAt: { gte: since } },
    select: { query: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return recentRuns.some((run) => normalizeScanQuery(run.query) === normalized);
}

type ScanCompany = {
  id: string;
  name: string;
  website: string | null;
  status: string;
  thesisFit: string | null;
  vertical: string | null;
  stage: string | null;
};

type RelevanceData = {
  relevant: boolean;
  companyName: string | null;
  oneLiner: string | null;
  reason: string;
};

type RelevanceTriple =
  | { result: TavilyResult; relevance: RelevanceData; error: null }
  | { result: TavilyResult; relevance: null; error: string };

type Candidate = {
  result: TavilyResult;
  companyName: string;
  oneLiner: string | null;
};

const activeCompanyNameKeys = new Set<string>();

async function getExistingCompanyNameKeys(): Promise<Set<string>> {
  const companies = await db.$queryRaw<{ name: string; normalizedName: string | null }[]>`
    SELECT name, normalizedName FROM Company
  `;
  return new Set(companies.map((c) => c.normalizedName ?? normalizeCompanyName(c.name)));
}

async function companyNameExists(nameKey: string): Promise<boolean> {
  if (!nameKey) return true;
  const existing = await getExistingCompanyNameKeys();
  return existing.has(nameKey);
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    (err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2002" || err.code === "P2010")) ||
    (err instanceof Error && err.message.includes("UNIQUE constraint failed"))
  );
}

async function attachNormalizedName(companyId: string, normalizedName: string): Promise<void> {
  await db.$executeRaw`
    UPDATE Company SET normalizedName = ${normalizedName} WHERE id = ${companyId}
  `;
}

async function generateCompanyAnalysis({
  companyName,
  result,
}: {
  companyName: string;
  result: TavilyResult;
}): Promise<{
  profile: Omit<CompanyProfile, "_meta" | "signalsExtracted"> & {
    signalsExtracted: SignalItem[];
    _meta: CompanyProfile["_meta"];
  };
  thesisFit: Omit<ThesisFit, "_meta"> & {
    _meta: ThesisFit["_meta"];
  };
} | null> {
  const analysisResult = await callLLM(
    "company_analysis",
    COMPANY_ANALYSIS_PROMPT.system,
    COMPANY_ANALYSIS_PROMPT.buildUser({
      name: companyName,
      website: result.url,
      rawScrapedText: result.content,
    }),
    CompanyAnalysisSchema,
    { buildFallback: () => null }
  );

  if (!analysisResult.meta.fallback && analysisResult.data) {
    return {
      profile: {
        ...analysisResult.data.profile,
        signalsExtracted: normalizeSignals(analysisResult.data.profile.signalsExtracted, result.url),
        _meta: {
          model: analysisResult.meta.model,
          generatedAt: new Date().toISOString(),
          promptVersion: COMPANY_ANALYSIS_PROMPT.version,
          fallback: false,
        },
      },
      thesisFit: {
        ...analysisResult.data.thesisFit,
        _meta: {
          model: analysisResult.meta.model,
          generatedAt: new Date().toISOString(),
          promptVersion: COMPANY_ANALYSIS_PROMPT.version,
          fallback: false,
        },
      },
    };
  }

  console.warn(`[agent] Combined analysis failed for ${companyName}; falling back to separate profile/thesis calls`);

  const profileSchema = CompanyProfileSchema.omit({ _meta: true });
  const profileResult = await callLLM(
    "profile_generation",
    PROFILE_PROMPT.system,
    PROFILE_PROMPT.buildUser({
      name: companyName,
      website: result.url,
      rawScrapedText: result.content,
    }),
    profileSchema,
    { buildFallback: () => null }
  );

  if (profileResult.meta.fallback || !profileResult.data) {
    console.log(`[agent] Profile generation failed for ${companyName} — skipping`);
    return null;
  }

  const profile = {
    ...profileResult.data,
    signalsExtracted: normalizeSignals(profileResult.data.signalsExtracted, result.url),
    _meta: {
      model: profileResult.meta.model,
      generatedAt: new Date().toISOString(),
      promptVersion: PROFILE_PROMPT.version,
      fallback: false,
    },
  };

  const thesisFitSchema = ThesisFitSchema.omit({ _meta: true });
  const thesisResult = await callLLM(
    "thesis_fit",
    THESIS_FIT_PROMPT.system,
    THESIS_FIT_PROMPT.buildUser({
      profileJson: JSON.stringify(profileResult.data, null, 2),
    }),
    thesisFitSchema,
    { temperature: 0, buildFallback: () => null }
  );

  if (thesisResult.meta.fallback || !thesisResult.data) {
    console.log(`[agent] Thesis fit failed for ${companyName} — skipping`);
    return null;
  }

  return {
    profile,
    thesisFit: {
      ...thesisResult.data,
      _meta: {
        model: thesisResult.meta.model,
        generatedAt: new Date().toISOString(),
        promptVersion: THESIS_FIT_PROMPT.version,
        fallback: false,
      },
    },
  };
}

export async function runScan({
  query,
  goal = 3,
  maxGoal = 5,
  maxIterations = 2,
  softTimeBudgetMs = 60_000,
  hardTimeBudgetMs = 120_000,
  onProgress,
  signal,
}: {
  query: string;
  goal?: number;
  maxGoal?: number;
  maxIterations?: number;
  softTimeBudgetMs?: number;
  hardTimeBudgetMs?: number;
  onProgress?: (event: ScanProgressEvent) => void;
  signal?: AbortSignal;
}): Promise<{
  created: ScanCompany[];
  skipped: { url: string; reason: string }[];
  scanRunId: string;
}> {
  const scanMode = process.env.SCAN_MODE ?? "mock";
  const constraints = extractConstraints(query);
  const startedAt = Date.now();

  function elapsedMs() {
    return Date.now() - startedAt;
  }

  function inFastWindow() {
    return elapsedMs() < softTimeBudgetMs;
  }

  function currentTarget() {
    return inFastWindow() ? maxGoal : goal;
  }

  // ── MOCK MODE: single-pass logic on fixture ─────────────────────────────────
  if (scanMode === "mock") {
    const mockPath = join(process.cwd(), "prisma", "mock-scan-results.json");
    const results = JSON.parse(readFileSync(mockPath, "utf-8")) as TavilyResult[];

    // Phase A: parallel relevance filtering
    const relevanceTriples = await Promise.all(
      results.map(async (result): Promise<RelevanceTriple> => {
        try {
          const r = await callLLM(
            "relevance_filter",
            RELEVANCE_FILTER_PROMPT.system,
            RELEVANCE_FILTER_PROMPT.buildUser(result),
            RelevanceFilterSchema,
            {
              temperature: 0,
              buildFallback: () => ({
                relevant: false,
                companyName: null,
                oneLiner: null,
                reason: "Relevance filter failed — defaulting to skip",
              }),
            }
          );
          return { result, relevance: r.data, error: null };
        } catch (err) {
          console.error("[agent] Relevance filter error for", result.url, err);
          return { result, relevance: null, error: "relevance filter error" };
        }
      })
    );

    // Phase B: dedup + collect candidates
    const existingNames = await getExistingCompanyNameKeys();

    const skipped: { url: string; reason: string }[] = [];
    const candidates: Candidate[] = [];

    for (const triple of relevanceTriples) {
      if (candidates.length >= goal) break;
      const { result } = triple;

      if (triple.error !== null) {
        skipped.push({ url: result.url, reason: triple.error });
        continue;
      }

      const { relevance } = triple;
      if (!relevance.relevant) {
        console.log(`[agent] Skipping ${result.url}: ${relevance.reason}`);
        skipped.push({ url: result.url, reason: relevance.reason });
        continue;
      }

      const companyName = relevance.companyName;
      if (!companyName) {
        console.log(`[agent] No company name extracted: ${result.url}`);
        skipped.push({ url: result.url, reason: "no company name extracted" });
        continue;
      }

      const companyNameKey = normalizeCompanyName(companyName);
      if (!companyNameKey || existingNames.has(companyNameKey) || activeCompanyNameKeys.has(companyNameKey)) {
        console.log(`[agent] Duplicate: ${companyName}`);
        skipped.push({ url: result.url, reason: "duplicate" });
        continue;
      }

      existingNames.add(companyNameKey);
      candidates.push({ result, companyName, oneLiner: relevance.oneLiner });
    }

    // Phase C: parallel profile+thesis chains — DB write only after both succeed
    async function processCandidate(candidate: Candidate): Promise<ScanCompany | null> {
      const { result, companyName, oneLiner } = candidate;
      const companyNameKey = normalizeCompanyName(companyName);

      if (!companyNameKey || activeCompanyNameKeys.has(companyNameKey) || await companyNameExists(companyNameKey)) {
        console.log(`[agent] Duplicate before processing: ${companyName}`);
        skipped.push({ url: result.url, reason: "duplicate" });
        return null;
      }

      activeCompanyNameKeys.add(companyNameKey);

      try {
        const analysis = await generateCompanyAnalysis({ companyName, result });
        if (!analysis) {
          skipped.push({ url: result.url, reason: "company analysis failed" });
          return null;
        }

        const headlineVertical = mapToThesisVertical(
          analysis.profile.verticalTags ?? []
        );
        const llmStage = normalizeStageValue(analysis.profile.stage);
        const finalStage = llmStage ?? detectStage(result.content) ?? null;

        if (!matchesRequestedVertical(headlineVertical, constraints.verticals)) {
          skipped.push({
            url: result.url,
            reason: `final vertical ${headlineVertical ?? "unknown"} did not match requested vertical`,
          });
          return null;
        }
        if (!matchesRequestedStage(finalStage, constraints.stages, false)) {
          skipped.push({
            url: result.url,
            reason: `final stage ${finalStage ?? "unknown"} did not match requested stage`,
          });
          return null;
        }

        if (await companyNameExists(companyNameKey)) {
          console.log(`[agent] Duplicate before create: ${companyName}`);
          skipped.push({ url: result.url, reason: "duplicate" });
          return null;
        }

        // Phase 3: all data ready — single DB write
        const company = await db.company.create({
          data: {
            name: companyName,
            website: result.url,
            oneLiner,
            sourceUrl: result.url,
            rawScrapedText: result.content,
            status: "NEW",
            vertical: headlineVertical,
            stage: finalStage,
            profile: JSON.stringify(analysis.profile),
            thesisFit: JSON.stringify(analysis.thesisFit),
          },
        });
        try {
          await attachNormalizedName(company.id, companyNameKey);
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            console.log(`[agent] Duplicate rejected by database: ${companyName}`);
            await db.company.delete({ where: { id: company.id } }).catch(() => {});
            skipped.push({ url: result.url, reason: "duplicate" });
            return null;
          }
          throw err;
        }
        console.log(`[agent] Created company (fully populated): ${companyName}`);
        return company;
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          console.log(`[agent] Duplicate rejected by database: ${companyName}`);
          skipped.push({ url: result.url, reason: "duplicate" });
          return null;
        }
        throw err;
      } finally {
        activeCompanyNameKeys.delete(companyNameKey);
      }
    }

    const settled = await Promise.allSettled(candidates.map(processCandidate));

    const created: ScanCompany[] = [];
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value !== null) {
        created.push(s.value);
      } else if (s.status === "rejected") {
        console.error("[agent] Company chain rejected:", s.reason);
      }
    }

    const scanRun = await db.scanRun.create({
      data: {
        query,
        sourcesUsed: JSON.stringify(["mock"]),
        companyCount: created.length,
      },
    });

    onProgress?.({
      type: "complete",
      created: created.length,
      skipped: skipped.length,
      scanRunId: scanRun.id,
    });

    console.log(`[agent] Scan complete — ${created.length} created, ${skipped.length} skipped`);
    return { created, skipped, scanRunId: scanRun.id };
  }

  // ── LIVE MODE: agentic loop ─────────────────────────────────────────────────
  onProgress?.({
    type: "constraints",
    verticals: constraints.verticals,
    stages: constraints.stages,
    stageLabels: constraints.stageLabels,
    geographies: constraints.geographies,
    focusTerms: constraints.focusTerms,
    timeLabel: constraints.timeLabel,
  });

  const existingNames = await getExistingCompanyNameKeys();
  const seenUrls = new Set<string>();
  const repeatMode = await wasQueryRunRecently(query);

    const created: ScanCompany[] = [];
    const skipped: { url: string; reason: string }[] = [];
    const triedQueries: string[] = repeatMode && query.trim()
    ? [stripConstraintNoise(query)]
    : [];
  let recoveryMode = false;
  let extraIterations = repeatMode ? 1 : 0;

  for (let iteration = 0; iteration < maxIterations + extraIterations; iteration++) {
    const elapsed = elapsedMs();
    if (elapsed >= hardTimeBudgetMs) {
      console.log(
        `[agent] Hard stop reached after ${Math.round(elapsed / 1000)}s — returning ${created.length} companies`
      );
      break;
    }
    if (elapsed >= softTimeBudgetMs && created.length >= goal) {
      console.log(
        `[agent] Soft stop reached after ${Math.round(elapsed / 1000)}s with ${created.length} companies`
      );
      break;
    }
    if (inFastWindow() && created.length >= maxGoal) {
      console.log(`[agent] Reached fast-window cap of ${maxGoal} companies`);
      break;
    }
    if (signal?.aborted) {
      console.log("[agent] Scan aborted by client");
      break;
    }
    const createdBeforeIteration = created.length;
    const targetForIteration = currentTarget();

    // ── Plan: decide what to search next ────────────────────────────────────
    let planQuery = "";
    let planReasoning = "";

    if (iteration === 0 && query.trim() && !repeatMode) {
      planQuery = stripConstraintNoise(query);
      planReasoning = "Starting with the user's query";
    } else {
      try {
        const planResult = await callLLM(
          "agent_planner",
          AGENT_PLANNER_PROMPT.system,
          AGENT_PLANNER_PROMPT.buildContext({
            remaining: Math.max(0, targetForIteration - created.length),
            found: created.map((c) => ({
              name: c.name,
              vertical: c.vertical,
              stage: c.stage,
            })),
            triedQueries,
            userQuery: query,
            constraints,
            repeatMode,
            recoveryMode,
          }),
          AgentPlannerSchema,
          {
            temperature: 0.3,
            buildFallback: () => ({
              reasoning: "fallback",
              query: "AI healthcare startup raised funding",
              done: false,
            }),
          }
        );

        if (planResult.data.done) {
          console.log("[agent] Planner says done");
          break;
        }

        planQuery = planResult.data.query;
        planReasoning = planResult.data.reasoning;
      } catch (err) {
        console.error("[agent] Planner failed:", err);
        break;
      }
    }

    if (!planQuery || triedQueries.includes(planQuery)) {
      if (created.length === 0 && !recoveryMode) {
        console.log("[agent] Empty or repeated planner query before any results — enabling recovery mode");
        recoveryMode = true;
        extraIterations = Math.max(extraIterations, 1);
        continue;
      }
      console.log("[agent] Planner repeated a query or returned empty, stopping");
      break;
    }

    triedQueries.push(planQuery);
    onProgress?.({
      type: "iteration",
      iteration: iteration + 1,
      query: planQuery,
      reasoning: planReasoning,
    });
    console.log(`[agent] Iteration ${iteration + 1}: "${planQuery}" — ${planReasoning}`);

    // ── Search ───────────────────────────────────────────────────────────────
    let searchResults: TavilyResult[];
    try {
      const searchHorizon = recoveryMode || repeatMode ? 12 : 8;
      searchResults = await tavilySearch(planQuery, constraints.days, searchHorizon);
    } catch (err) {
      console.error("[agent] Tavily failed:", err);
      onProgress?.({ type: "error", message: "Search failed — skipping iteration" });
      continue;
    }

    // Dedup URLs across iterations
    const newResults = searchResults.filter((r) => !seenUrls.has(r.url));
    newResults.forEach((r) => seenUrls.add(r.url));

    if (newResults.length === 0) {
      console.log("[agent] No new URLs this iteration");
      if (created.length === 0 && !recoveryMode) {
        console.log("[agent] No new URLs before any created companies — enabling recovery mode");
        recoveryMode = true;
        extraIterations = Math.max(extraIterations, 1);
      }
      if (elapsed >= softTimeBudgetMs && created.length >= goal) {
        console.log("[agent] Stopping early — enough companies found after soft time budget");
        break;
      }
      continue;
    }

    // ── Relevance filter (parallel) ──────────────────────────────────────────
    const relevanceResults = await Promise.all(
      newResults.map(async (result) => {
        try {
          const r = await callLLM(
            "relevance_filter",
            RELEVANCE_FILTER_PROMPT.system,
            RELEVANCE_FILTER_PROMPT.buildUser({ ...result, constraints }),
            RelevanceFilterSchema,
            {
              temperature: 0,
              buildFallback: () => ({
                relevant: false,
                companyName: null,
                oneLiner: null,
                reason: "Relevance filter failed — defaulting to skip",
              }),
            }
          );
          return { result, relevance: r.data as RelevanceData | null, error: null as unknown };
        } catch (err) {
          return { result, relevance: null as RelevanceData | null, error: err as unknown };
        }
      })
    );

    // ── Process relevant candidates (parallel within iteration) ─────────────
    // Track relevant results with no company name before launching parallel chains
    relevanceResults
      .filter(({ relevance, error }) => !error && relevance?.relevant && !relevance?.companyName)
      .forEach(({ result }) => {
        skipped.push({ url: result.url, reason: "no company name extracted" });
        onProgress?.({ type: "skipped", url: result.url, reason: "no company name extracted" });
      });

    const candidateResults = await Promise.allSettled(
      relevanceResults
        .filter(({ relevance, error }) => !error && relevance?.relevant && relevance?.companyName)
        .slice(0, Math.max(0, targetForIteration - created.length))
        .map(async ({ result, relevance }) => {
          const companyName = relevance!.companyName!;
          const companyNameKey = normalizeCompanyName(companyName);

          if (!companyNameKey || existingNames.has(companyNameKey) || activeCompanyNameKeys.has(companyNameKey)) {
            skipped.push({ url: result.url, reason: "duplicate" });
            onProgress?.({ type: "skipped", url: result.url, reason: "duplicate" });
            return null;
          }
          // Register name immediately to prevent parallel duplicates
          existingNames.add(companyNameKey);
          activeCompanyNameKeys.add(companyNameKey);

          try {
            const analysis = await generateCompanyAnalysis({ companyName, result });
            if (!analysis) {
              skipped.push({ url: result.url, reason: "company analysis failed" });
              onProgress?.({ type: "skipped", url: result.url, reason: "company analysis failed" });
              return null;
            }

            const headlineVertical = mapToThesisVertical(
              analysis.profile.verticalTags ?? []
            );
            const llmStage = normalizeStageValue(analysis.profile.stage);
            const finalStage = llmStage ?? detectStage(result.content) ?? null;

            if (!matchesRequestedVertical(headlineVertical, constraints.verticals)) {
              skipped.push({
                url: result.url,
                reason: `final vertical ${headlineVertical ?? "unknown"} did not match requested vertical`,
              });
              onProgress?.({
                type: "skipped",
                url: result.url,
                reason: `final vertical ${headlineVertical ?? "unknown"} did not match requested vertical`,
              });
              return null;
            }
            if (!matchesRequestedStage(finalStage, constraints.stages, recoveryMode)) {
              skipped.push({
                url: result.url,
                reason: `final stage ${finalStage ?? "unknown"} did not match requested stage`,
              });
              onProgress?.({
                type: "skipped",
                url: result.url,
                reason: `final stage ${finalStage ?? "unknown"} did not match requested stage`,
              });
              return null;
            }

            if (await companyNameExists(companyNameKey)) {
              console.log(`[agent] Duplicate before create: ${companyName}`);
              skipped.push({ url: result.url, reason: "duplicate" });
              onProgress?.({ type: "skipped", url: result.url, reason: "duplicate" });
              return null;
            }

            // Phase 3: both succeeded — single DB write with all fields populated
            const company = await db.company.create({
              data: {
                name: companyName,
                website: result.url,
                oneLiner: relevance!.oneLiner,
                sourceUrl: result.url,
                rawScrapedText: result.content,
                status: "NEW",
                vertical: headlineVertical,
                stage: finalStage,
                profile: JSON.stringify(analysis.profile),
                thesisFit: JSON.stringify(analysis.thesisFit),
              },
            });
            try {
              await attachNormalizedName(company.id, companyNameKey);
            } catch (err) {
              if (isUniqueConstraintError(err)) {
                console.log(`[agent] Duplicate rejected by database: ${companyName}`);
                await db.company.delete({ where: { id: company.id } }).catch(() => {});
                skipped.push({ url: result.url, reason: "duplicate" });
                onProgress?.({ type: "skipped", url: result.url, reason: "duplicate" });
                return null;
              }
              throw err;
            }
            console.log(`[agent] Created company (fully populated): ${companyName}`);

            onProgress?.({
              type: "found",
              company: companyName,
              vertical: headlineVertical,
              stage: finalStage,
              score: analysis.thesisFit.score,
            });

            return company;
          } catch (err) {
            if (isUniqueConstraintError(err)) {
              console.log(`[agent] Duplicate rejected by database: ${companyName}`);
              skipped.push({ url: result.url, reason: "duplicate" });
              onProgress?.({ type: "skipped", url: result.url, reason: "duplicate" });
              return null;
            }
            throw err;
          } finally {
            activeCompanyNameKeys.delete(companyNameKey);
          }
        })
    );

    // Collect successful results
    candidateResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value !== null) {
        created.push(result.value);
      }
    });
    const createdThisIteration = created.length - createdBeforeIteration;

    if (created.length === 0 && createdThisIteration === 0 && !recoveryMode) {
      console.log("[agent] No new companies created on first pass — enabling recovery mode");
      recoveryMode = true;
      extraIterations = Math.max(extraIterations, 1);
    }

    // Track non-relevant / errored results as skipped
    for (const { result, relevance, error } of relevanceResults) {
      if (!error && relevance?.relevant) continue;
      const reason = error
        ? "relevance filter error"
        : (relevance?.reason ?? "not relevant");
      skipped.push({ url: result.url, reason });
      onProgress?.({ type: "skipped", url: result.url, reason });
    }

    if (elapsedMs() >= softTimeBudgetMs && created.length >= goal && createdThisIteration === 0) {
      console.log("[agent] Stopping early — returns slowed after minimum target was met");
      break;
    }

    if (elapsedMs() < softTimeBudgetMs && created.length >= maxGoal) {
      console.log("[agent] Stopping early — hit opportunistic fast-window cap");
      break;
    }
  }

  const scanRun = await db.scanRun.create({
    data: {
      query,
      sourcesUsed: JSON.stringify(["tavily"]),
      companyCount: created.length,
    },
  });

  onProgress?.({
    type: "complete",
    created: created.length,
    skipped: skipped.length,
    scanRunId: scanRun.id,
  });

  console.log(
    `[agent] Scan complete — ${created.length} created, ${skipped.length} skipped`
  );
  return { created, skipped, scanRunId: scanRun.id };
}
