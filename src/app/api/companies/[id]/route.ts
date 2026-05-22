import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({
  field: z.string().min(1),
  value: z.any(),
  section: z.enum(["profile", "thesisFit", "company"]),
});

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

  // Direct thesisFit replacement (used by eval model adoption)
  const raw = body as Record<string, unknown>;
  if (raw.thesisFit !== undefined) {
    try {
      const company = await db.company.findUnique({ where: { id } });
      if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
      const updated = await db.company.update({
        where: { id },
        data: { thesisFit: raw.thesisFit as string },
      });
      return NextResponse.json(updated);
    } catch {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { field, value, section } = parsed.data;

  try {
    const company = await db.company.findUnique({ where: { id } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (section === "company") {
      updateData[field] = value;
    } else {
      const jsonStr =
        section === "profile" ? company.profile : company.thesisFit;
      const json: Record<string, unknown> = jsonStr
        ? JSON.parse(jsonStr)
        : {};
      json[field] = value;
      updateData[section] = JSON.stringify(json);

      const humanEdits: Record<string, boolean> = company.humanEdits
        ? JSON.parse(company.humanEdits)
        : {};
      humanEdits[`${section}.${field}`] = true;
      updateData.humanEdits = JSON.stringify(humanEdits);
    }

    const updated = await db.company.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
