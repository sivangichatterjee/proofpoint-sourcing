import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runScan } from "@/lib/agent";

// Allow up to 120s — sequential LLM calls per company add up
export const maxDuration = 120;

const bodySchema = z.object({
  query: z.string().min(1, "Query is required"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const { created, skipped, scanRunId } = await runScan({
      query: parsed.data.query,
    });
    return NextResponse.json({
      created: created.length,
      skipped: skipped.length,
      scanRunId,
      companies: created.map((c) => c.id),
    });
  } catch (err) {
    console.error("[scan route] Unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}
