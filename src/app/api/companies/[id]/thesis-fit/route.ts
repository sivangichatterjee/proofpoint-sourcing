import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { THESIS_FIT_PROMPT } from "@/lib/prompts";
import { ThesisFitSchema } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const humanEditedRationale: string | undefined = body?.humanEditedRationale ?? undefined;

  const company = await db.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!company.profile) {
    return NextResponse.json({ error: "Generate profile first" }, { status: 400 });
  }

  let profileForPrompt: Record<string, unknown>;
  try {
    const { _meta, ...rest } = JSON.parse(company.profile) as Record<string, unknown>;
    void _meta;
    profileForPrompt = rest;
  } catch {
    return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });
  }

  const thesisFitSchema = ThesisFitSchema.omit({ _meta: true });

  const result = await callLLM(
    "thesis_fit",
    THESIS_FIT_PROMPT.system,
    THESIS_FIT_PROMPT.buildUser({ profileJson: JSON.stringify(profileForPrompt, null, 2), humanEditedRationale }),
    thesisFitSchema,
    {
      buildFallback: () => ({
  score: 0,
  recommendation: "REVIEWING" as const,
  rationale: "[Generation failed — please retry. This is a fallback response, not a real thesis assessment.]",
}),
      temperature: 0,
    }
  );

  const thesisFit = {
    ...result.data,
    _meta: {
      model: result.meta.model,
      generatedAt: new Date().toISOString(),
      promptVersion: THESIS_FIT_PROMPT.version,
      fallback: result.meta.fallback,
    },
  };

  await db.company.update({
    where: { id },
    data: { thesisFit: JSON.stringify(thesisFit) },
  });

  return NextResponse.json({ thesisFit });
}
