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
} from "@/lib/prompts";
import {
  RelevanceFilterSchema,
  CompanyProfileSchema,
  ThesisFitSchema,
} from "@/lib/types";

type ScanCompany = {
  id: string;
  name: string;
  website: string | null;
  status: string;
  thesisFit: string | null;
};

export async function runScan({
  query,
  limit = 5,
}: {
  query: string;
  limit?: number;
}): Promise<{
  created: ScanCompany[];
  skipped: { url: string; reason: string }[];
  scanRunId: string;
}> {
  const scanMode = process.env.SCAN_MODE ?? "mock";

  let results: TavilyResult[];
  if (scanMode === "mock") {
    const mockPath = join(process.cwd(), "prisma", "mock-scan-results.json");
    results = JSON.parse(readFileSync(mockPath, "utf-8")) as TavilyResult[];
  } else {
    results = await tavilySearch(query);
  }

  // Fetch existing names once for O(1) duplicate detection.
  // SQLite doesn't support mode:"insensitive" via Prisma, so we normalize in JS.
  const existingNames = new Set(
    (await db.company.findMany({ select: { name: true } })).map((c) =>
      c.name.toLowerCase()
    )
  );

  const created: ScanCompany[] = [];
  const skipped: { url: string; reason: string }[] = [];

  for (const result of results) {
    if (created.length >= limit) break;

    // ── 1. Relevance filter ────────────────────────────────────────────────────
    let relevanceData: {
      relevant: boolean;
      companyName: string | null;
      oneLiner: string | null;
      reason: string;
    };
    try {
      const relevanceResult = await callLLM(
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
      relevanceData = relevanceResult.data;
    } catch (err) {
      console.error("[agent] Relevance filter error for", result.url, err);
      skipped.push({ url: result.url, reason: "relevance filter error" });
      continue;
    }

    if (!relevanceData.relevant) {
      console.log(`[agent] Skipping ${result.url}: ${relevanceData.reason}`);
      skipped.push({ url: result.url, reason: relevanceData.reason });
      continue;
    }

    // ── 2. Duplicate check ─────────────────────────────────────────────────────
    const companyName = relevanceData.companyName;
if (!companyName) {
  console.log(`[agent] Relevance flagged true but no company name extracted: ${result.url}`);
  skipped.push({ url: result.url, reason: "no company name extracted" });
  continue;
}
if (existingNames.has(companyName.toLowerCase())) {
      console.log(`[agent] Duplicate: ${companyName}`);
      skipped.push({ url: result.url, reason: "duplicate" });
      continue;
    }

    // ── 3. Create company row ──────────────────────────────────────────────────
    let company = await db.company.create({
      data: {
        name: companyName,
        website: result.url,
        oneLiner: relevanceData.oneLiner,
        sourceUrl: result.url,
        rawScrapedText: result.content,
        status: "NEW",
      },
    });
    existingNames.add(companyName.toLowerCase());
    console.log(`[agent] Created company: ${companyName}`);

    // ── 4. Profile generation ──────────────────────────────────────────────────
    try {
      const profileSchema = CompanyProfileSchema.omit({ _meta: true });
      const profileResult = await callLLM(
        "profile_generation",
        PROFILE_PROMPT.system,
        PROFILE_PROMPT.buildUser({
          name: company.name,
          website: company.website,
          rawScrapedText: company.rawScrapedText,
        }),
        profileSchema,
        {
          buildFallback: () => ({
            description: "[Generation failed — please retry.]",
            productSummary: "",
            targetCustomer: "",
            verticalTags: [],
            signalsExtracted: [],
          }),
        }
      );

      const profile = {
        ...profileResult.data,
        _meta: {
          model: profileResult.meta.model,
          generatedAt: new Date().toISOString(),
          promptVersion: PROFILE_PROMPT.version,
          fallback: profileResult.meta.fallback,
        },
      };

      company = await db.company.update({
        where: { id: company.id },
        data: { profile: JSON.stringify(profile) },
      });

      // ── 5. Thesis fit ────────────────────────────────────────────────────────
      const thesisFitSchema = ThesisFitSchema.omit({ _meta: true });
      const thesisResult = await callLLM(
        "thesis_fit",
        THESIS_FIT_PROMPT.system,
        THESIS_FIT_PROMPT.buildUser({
          profileJson: JSON.stringify(profileResult.data, null, 2),
        }),
        thesisFitSchema,
        {
          temperature: 0,
          buildFallback: () => ({
            score: 0,
            recommendation: "REVIEWING" as const,
            rationale: "[Generation failed — please retry.]",
          }),
        }
      );

      const thesisFit = {
        ...thesisResult.data,
        _meta: {
          model: thesisResult.meta.model,
          generatedAt: new Date().toISOString(),
          promptVersion: THESIS_FIT_PROMPT.version,
          fallback: thesisResult.meta.fallback,
        },
      };

      company = await db.company.update({
        where: { id: company.id },
        data: { thesisFit: JSON.stringify(thesisFit) },
      });
    } catch (err) {
      console.error(
        `[agent] Profile/thesis generation failed for ${companyName}:`,
        err
      );
      // Company is already persisted at NEW status — keep processing
    }

    created.push(company);
  }

  const scanRun = await db.scanRun.create({
    data: {
      query,
      sourcesUsed: JSON.stringify([scanMode === "mock" ? "mock" : "tavily"]),
      companyCount: created.length,
    },
  });

  console.log(
    `[agent] Scan complete — ${created.length} created, ${skipped.length} skipped`
  );
  return { created, skipped, scanRunId: scanRun.id };
}
