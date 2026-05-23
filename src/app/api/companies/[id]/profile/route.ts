import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { PROFILE_PROMPT } from "@/lib/prompts";
import { CompanyProfileSchema, normalizeSignals } from "@/lib/types";
import { detectStage, normalizeStageValue } from "@/lib/stage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rawBody = await req.json().catch(() => ({}));
  const body =
    rawBody && typeof rawBody === "object"
      ? (rawBody as Record<string, unknown>)
      : {};
  const humanEdits =
    body.humanEdits && typeof body.humanEdits === "object"
      ? (body.humanEdits as Record<string, string>)
      : undefined;
  const analystGuidance =
    typeof body.analystGuidance === "string"
      ? body.analystGuidance.trim() || undefined
      : undefined;

  const company = await db.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profileSchema = CompanyProfileSchema.omit({ _meta: true });

  const result = await callLLM(
    "profile_generation",
    PROFILE_PROMPT.system,
    PROFILE_PROMPT.buildUser({
      name: company.name,
      website: company.website,
      rawScrapedText: company.rawScrapedText,
      humanEdits,
      analystGuidance,
    }),
    profileSchema,
    {
      buildFallback: () => null,
    }
  );

  if (result.meta.fallback || !result.data) {
    return NextResponse.json(
      { error: "Profile generation failed. Existing profile was not changed." },
      { status: 503 }
    );
  }

  const llmStage = normalizeStageValue(result.data.stage);
  const fallbackStage = detectStage(company.rawScrapedText);
  const finalStage = llmStage ?? fallbackStage ?? null;

  const profile = {
    ...result.data,
    signalsExtracted: normalizeSignals(result.data.signalsExtracted, company.sourceUrl ?? undefined),
    _meta: {
      model: result.meta.model,
      generatedAt: new Date().toISOString(),
      promptVersion: PROFILE_PROMPT.version,
      fallback: result.meta.fallback,
      ...(analystGuidance ? { analystGuidance } : {}),
    },
  };

  await db.company.update({
    where: { id },
    data: {
      profile: JSON.stringify(profile),
      stage: finalStage,
    },
  });

  return NextResponse.json({ profile });
}
