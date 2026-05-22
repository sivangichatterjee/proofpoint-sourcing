import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { PROFILE_PROMPT } from "@/lib/prompts";
import { CompanyProfileSchema, normalizeSignals } from "@/lib/types";
import { detectStage } from "@/lib/stage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const humanEdits: Record<string, string> | undefined = body?.humanEdits ?? undefined;

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
    }),
    profileSchema,
    {
      buildFallback: () => ({
        description: "[Generation failed — please retry. Showing fallback response, not a real profile.]",
        productSummary: "",
        targetCustomer: "",
        verticalTags: [],
        signalsExtracted: [],
        stage: null,
      }),
    }
  );

  const llmStage = result.data.stage;
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
