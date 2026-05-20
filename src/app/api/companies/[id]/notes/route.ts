import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({ body: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Note body must be a non-empty string" },
      { status: 400 }
    );
  }

  try {
    const note = await db.note.create({
      data: { companyId: id, body: parsed.data.body },
    });
    return NextResponse.json(note);
  } catch {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
}
