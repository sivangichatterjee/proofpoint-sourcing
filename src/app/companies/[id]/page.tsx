import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CompanyDetail } from "@/components/company-detail";
import type { CompanyProfile, ThesisFit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await db.company.findUnique({
    where: { id },
    include: { notes: { orderBy: { createdAt: "desc" } } },
  });

  if (!company) notFound();

  let profile: CompanyProfile | null = null;
  let thesisFit: ThesisFit | null = null;
  let humanEdits: Record<string, boolean> | null = null;

  try {
    if (company.profile) profile = JSON.parse(company.profile);
  } catch {}
  try {
    if (company.thesisFit) thesisFit = JSON.parse(company.thesisFit);
  } catch {}
  try {
    if (company.humanEdits) humanEdits = JSON.parse(company.humanEdits);
  } catch {}

  return (
    <main className="container mx-auto max-w-7xl px-6 py-10">
      <CompanyDetail
        id={company.id}
        name={company.name}
        website={company.website}
        sourceUrl={company.sourceUrl}
        oneLiner={company.oneLiner}
        vertical={company.vertical}
        stage={company.stage}
        createdAt={company.createdAt.toISOString()}
        status={company.status}
        nextStep={company.nextStep}
        profile={profile}
        thesisFit={thesisFit}
        humanEdits={humanEdits}
        notes={company.notes.map((n) => ({
          id: n.id,
          body: n.body,
          author: n.author,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
