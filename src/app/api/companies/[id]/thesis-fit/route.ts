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
  const rawBody = await req.json().catch(() => ({}));
  const body =
    rawBody && typeof rawBody === "object"
      ? (rawBody as Record<string, unknown>)
      : {};
  const humanEditedRationale =
    typeof body.humanEditedRationale === "string"
      ? body.humanEditedRationale.trim() || undefined
      : undefined;
  const analystGuidance =
    typeof body.analystGuidance === "string"
      ? body.analystGuidance.trim() || undefined
      : undefined;

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
    THESIS_FIT_PROMPT.buildUser({
      profileJson: JSON.stringify(profileForPrompt, null, 2),
      humanEditedRationale,
      analystGuidance,
    }),
    thesisFitSchema,
    {
      buildFallback: () => null,
      temperature: 0,
    }
  );

  if (result.meta.fallback || !result.data) {
    return NextResponse.json(
      { error: "Thesis generation failed. Existing thesis fit was not changed." },
      { status: 503 }
    );
  }

  const thesisFit = {
    ...result.data,
    _meta: {
      model: result.meta.model,
      generatedAt: new Date().toISOString(),
      promptVersion: THESIS_FIT_PROMPT.version,
      fallback: result.meta.fallback,
      ...(analystGuidance ? { analystGuidance } : {}),
    },
  };

  await db.company.update({
    where: { id },
    data: { thesisFit: JSON.stringify(thesisFit) },
  });

  return NextResponse.json({ thesisFit });
}
