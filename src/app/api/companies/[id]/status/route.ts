import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { CompanyStatusSchema } from "@/lib/types";

const BodySchema = z.object({ status: CompanyStatusSchema });

export async function PATCH(
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
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const company = await db.company.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return NextResponse.json(company);
  } catch {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
}
