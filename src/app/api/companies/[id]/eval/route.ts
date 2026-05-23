import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { THESIS_FIT_PROMPT } from "@/lib/prompts";
import { ThesisFitSchema } from "@/lib/types";

const EVAL_MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
];

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

  const thesisFitSchema = ThesisFitSchema.omit({ _meta: true });

  const settled = await Promise.allSettled(
    EVAL_MODELS.map(async ({ id: modelId, label }) => {
      const result = await callLLM(
        "thesis_fit",
        THESIS_FIT_PROMPT.system,
        THESIS_FIT_PROMPT.buildUser({ profileJson }),
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
          model: EVAL_MODELS[i].id,
          modelLabel: EVAL_MODELS[i].label,
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

  const rejectedModels = EVAL_MODELS
    .filter((m) => m.id !== preferredModel)
    .map((m) => m.id);

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
