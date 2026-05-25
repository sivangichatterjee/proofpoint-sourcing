import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { THESIS_FIT_PROMPT } from "@/lib/prompts";
import {
  getAlternativeComparisonModels,
  getAnalystGuidanceFromThesisFitJson,
} from "@/lib/thesis";
import { ThesisFitSchema } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const company = await db.company.findUnique({ where: { id } });

  if (!company?.profile) {
    return Response.json({ error: "No profile found" }, { status: 400 });
  }

  let profileForPrompt: Record<string, unknown>;
  try {
    const { _meta, ...rest } = JSON.parse(company.profile) as Record<string, unknown>;
    void _meta;
    profileForPrompt = rest;
  } catch {
    return Response.json({ error: "Invalid profile data" }, { status: 400 });
  }

  const profileJson = JSON.stringify(profileForPrompt, null, 2);
  const analystGuidance = getAnalystGuidanceFromThesisFitJson(company.thesisFit);
  const currentModel = (() => {
    try {
      const parsed = company.thesisFit
        ? (JSON.parse(company.thesisFit) as { _meta?: { model?: unknown } })
        : null;
      return typeof parsed?._meta?.model === "string" ? parsed._meta.model : null;
    } catch {
      return null;
    }
  })();
  const evalModels = getAlternativeComparisonModels(currentModel);

  const thesisFitSchema = ThesisFitSchema.omit({ _meta: true });

  const settled = await Promise.allSettled(
    evalModels.map(async ({ id: modelId, label }) => {
      const result = await callLLM(
        "thesis_fit",
        THESIS_FIT_PROMPT.system,
        THESIS_FIT_PROMPT.buildUser({ profileJson, analystGuidance }),
        thesisFitSchema,
        {
          temperature: 0,
          modelOverride: modelId,
          allowModelFallback: false,
          buildFallback: () => null,
        }
      );

      if (result.meta.fallback || !result.data) {
        return {
          model: modelId,
          modelLabel: label,
          score: null,
          recommendation: null,
          rationale: "This model was unavailable or returned an invalid response.",
          fallback: true,
        };
      }

      return {
        model: modelId,
        modelLabel: label,
        score: result.data.score,
        recommendation: result.data.recommendation,
        rationale: result.data.rationale,
        fallback: result.meta.fallback,
      };
    })
  );

  const evalResults = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          model: evalModels[i].id,
          modelLabel: evalModels[i].label,
          score: null,
          recommendation: null,
          rationale: "This model was unavailable or returned an invalid response.",
          fallback: true,
        }
  );

  return Response.json({ results: evalResults });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { preferredModel, results, profileJson } = await req.json();

  const rejectedModels = Array.isArray(results)
    ? results
        .map((result) =>
          result && typeof result === "object" && typeof result.model === "string"
            ? result.model
            : null
        )
        .filter((model): model is string => !!model && model !== preferredModel)
    : [];

  await db.evalPreference.create({
    data: {
      companyId: id,
      preferredModel,
      rejectedModels: JSON.stringify(rejectedModels),
      profileJson: profileJson ?? "",
      results: JSON.stringify(results),
    },
  });

  return Response.json({ ok: true });
}
