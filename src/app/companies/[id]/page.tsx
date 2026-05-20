import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import type { CompanyStatus } from "@/lib/types";

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

  return (
    <main className="container mx-auto px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold">{company.name}</h1>
          <StatusBadge status={company.status as CompanyStatus} />
        </div>
        <div className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          {company.website && <span>{company.website}</span>}
          {company.vertical && <span>· {company.vertical}</span>}
          {company.stage && <span>· {company.stage}</span>}
        </div>
        {company.oneLiner && (
          <p className="mt-2 text-sm">{company.oneLiner}</p>
        )}
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
          Profile — AI-generated
        </h2>
        <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {company.profile
            ? JSON.stringify(JSON.parse(company.profile), null, 2)
            : "No profile yet — run a scan to generate."}
        </pre>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
          Thesis Fit — AI-generated
        </h2>
        <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {company.thesisFit
            ? JSON.stringify(JSON.parse(company.thesisFit), null, 2)
            : "No thesis fit yet — run a scan to generate."}
        </pre>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
          Notes ({company.notes.length})
        </h2>
        {company.notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(company.notes, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
