import { readFileSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { tavilySearch } from "@/lib/tavily";
import type { TavilyResult } from "@/lib/tavily";
import {
  RELEVANCE_FILTER_PROMPT,
  PROFILE_PROMPT,
  THESIS_FIT_PROMPT,
  AGENT_PLANNER_PROMPT,
} from "@/lib/prompts";
import {
  RelevanceFilterSchema,
  CompanyProfileSchema,
  ThesisFitSchema,
  AgentPlannerSchema,
  normalizeSignals,
} from "@/lib/types";
import { detectStage } from "@/lib/stage";
import { extractConstraints, stripConstraintNoise } from "@/lib/queryConstraints";

function mapToThesisVertical(tags: string[]): string | null {
  const allTags = tags.join(" ").toLowerCase();

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
    allTags.includes("fintech") ||
    allTags.includes("insurance") ||
    allTags.includes("underwriting") ||
    allTags.includes("lending") ||
    allTags.includes("banking") ||
    allTags.includes("financial") ||
    allTags.includes("payments") ||
    allTags.includes("wealth") ||
    allTags.includes("credit") ||
    allTags.includes("fraud") ||
    allTags.includes("compliance")
  ) {
    return "Fintech";
  }

  if (
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

  return null;
}

export type ScanProgressEvent =
  | { type: "constraints"; verticals: string[]; stages: string[]; timeLabel: string }
  | { type: "iteration"; iteration: number; query: string; reasoning: string }
  | { type: "found"; company: string; vertical: string | null; stage: string | null; score: number | null }
  | { type: "skipped"; url: string; reason: string }
  | { type: "complete"; created: number; skipped: number; scanRunId: string }
  | { type: "error"; message: string };

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

export async function runScan({
  query,
  goal = 5,
  maxIterations = 5,
  onProgress,
  signal,
}: {
  query: string;
  goal?: number;
  maxIterations?: number;
  onProgress?: (event: ScanProgressEvent) => void;
  signal?: AbortSignal;
}): Promise<{
  created: ScanCompany[];
  skipped: { url: string; reason: string }[];
  scanRunId: string;
}> {
  const scanMode = process.env.SCAN_MODE ?? "mock";

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
    const existingNames = new Set(
      (await db.company.findMany({ select: { name: true } })).map((c) =>
        c.name.toLowerCase()
      )
    );

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

      if (existingNames.has(companyName.toLowerCase())) {
        console.log(`[agent] Duplicate: ${companyName}`);
        skipped.push({ url: result.url, reason: "duplicate" });
        continue;
      }

      existingNames.add(companyName.toLowerCase());
      candidates.push({ result, companyName, oneLiner: relevance.oneLiner });
    }

    // Phase C: parallel profile+thesis chains — DB write only after both succeed
    async function processCandidate(candidate: Candidate): Promise<ScanCompany | null> {
      const { result, companyName, oneLiner } = candidate;

      // Phase 1: generate profile in memory
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
        skipped.push({ url: result.url, reason: "profile generation failed" });
        return null;
      }

      const headlineVertical = mapToThesisVertical(
        profileResult.data.verticalTags ?? []
      );
      const llmStage = profileResult.data.stage ?? null;
      const finalStage = llmStage ?? detectStage(result.content) ?? null;

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

      // Phase 2: generate thesis fit in memory
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
        skipped.push({ url: result.url, reason: "thesis fit generation failed" });
        return null;
      }

      const thesisFit = {
        ...thesisResult.data,
        _meta: {
          model: thesisResult.meta.model,
          generatedAt: new Date().toISOString(),
          promptVersion: THESIS_FIT_PROMPT.version,
          fallback: false,
        },
      };

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
          profile: JSON.stringify(profile),
          thesisFit: JSON.stringify(thesisFit),
        },
      });
      console.log(`[agent] Created company (fully populated): ${companyName}`);
      return company;
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
  const constraints = extractConstraints(query);
  onProgress?.({
    type: "constraints",
    verticals: constraints.verticals,
    stages: constraints.stages,
    timeLabel: constraints.timeLabel,
  });

  const existingNames = new Set(
    (await db.company.findMany({ select: { name: true } })).map((c) =>
      c.name.toLowerCase()
    )
  );
  const seenUrls = new Set<string>();

  const created: ScanCompany[] = [];
  const skipped: { url: string; reason: string }[] = [];
  const triedQueries: string[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (created.length >= goal) break;
    if (signal?.aborted) {
      console.log("[agent] Scan aborted by client");
      break;
    }

    // ── Plan: decide what to search next ────────────────────────────────────
    let planQuery = "";
    let planReasoning = "";

    if (iteration === 0 && query.trim()) {
      planQuery = stripConstraintNoise(query);
      planReasoning = "Starting with the user's query";
    } else {
      try {
        const planResult = await callLLM(
          "agent_planner",
          AGENT_PLANNER_PROMPT.system,
          AGENT_PLANNER_PROMPT.buildContext({
            remaining: goal - created.length,
            found: created.map((c) => ({
              name: c.name,
              vertical: c.vertical,
              stage: c.stage,
            })),
            triedQueries,
            userQuery: query,
            constraints,
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
      searchResults = await tavilySearch(planQuery, constraints.days);
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
        .slice(0, goal - created.length)
        .map(async ({ result, relevance }) => {
          const companyName = relevance!.companyName!;

          if (existingNames.has(companyName.toLowerCase())) {
            skipped.push({ url: result.url, reason: "duplicate" });
            return null;
          }
          // Register name immediately to prevent parallel duplicates
          existingNames.add(companyName.toLowerCase());

          // Phase 1: generate profile in memory — no DB write yet
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
            skipped.push({ url: result.url, reason: "profile generation failed" });
            onProgress?.({ type: "skipped", url: result.url, reason: "profile generation failed" });
            return null;
          }

          const headlineVertical = mapToThesisVertical(
        profileResult.data.verticalTags ?? []
      );
          const llmStage = profileResult.data.stage ?? null;
          const finalStage = llmStage ?? detectStage(result.content) ?? null;

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

          // Phase 2: generate thesis fit in memory — no DB write yet
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
            skipped.push({ url: result.url, reason: "thesis fit generation failed" });
            onProgress?.({ type: "skipped", url: result.url, reason: "thesis fit generation failed" });
            return null;
          }

          const thesisFit = {
            ...thesisResult.data,
            _meta: {
              model: thesisResult.meta.model,
              generatedAt: new Date().toISOString(),
              promptVersion: THESIS_FIT_PROMPT.version,
              fallback: false,
            },
          };

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
              profile: JSON.stringify(profile),
              thesisFit: JSON.stringify(thesisFit),
            },
          });
          console.log(`[agent] Created company (fully populated): ${companyName}`);

          onProgress?.({
            type: "found",
            company: companyName,
            vertical: headlineVertical,
            stage: finalStage,
            score: thesisResult.data.score,
          });

          return company;
        })
    );

    // Collect successful results
    candidateResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value !== null) {
        created.push(result.value);
      }
    });

    // Track non-relevant / errored results as skipped
    for (const { result, relevance, error } of relevanceResults) {
      if (!error && relevance?.relevant) continue;
      const reason = error
        ? "relevance filter error"
        : (relevance?.reason ?? "not relevant");
      skipped.push({ url: result.url, reason });
      onProgress?.({ type: "skipped", url: result.url, reason });
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
