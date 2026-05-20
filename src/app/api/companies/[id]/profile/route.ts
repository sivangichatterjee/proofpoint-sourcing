import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { PROFILE_PROMPT } from "@/lib/prompts";
import { CompanyProfileSchema } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    }),
    profileSchema,
    {
      buildFallback: () => ({
     description: "[Generation failed — please retry. Showing fallback response, not a real profile.]",
     productSummary: "",
     targetCustomer: "",
     verticalTags: [],
     signalsExtracted: [],
   }),
    }
  );

  const profile = {
    ...result.data,
    _meta: {
      model: result.meta.model,
      generatedAt: new Date().toISOString(),
      promptVersion: PROFILE_PROMPT.version,
      fallback: result.meta.fallback,
    },
  };

  await db.company.update({
    where: { id },
    data: { profile: JSON.stringify(profile) },
  });

  return NextResponse.json({ profile });
}
