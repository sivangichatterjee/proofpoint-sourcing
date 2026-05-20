import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { QueueTable } from "@/components/queue-table";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [companies, lastScan] = await Promise.all([
    db.company.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        website: true,
        vertical: true,
        stage: true,
        status: true,
        thesisFit: true,
        createdAt: true,
      },
    }),
    db.scanRun.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  const lastScanLabel = lastScan
    ? `Last scan: ${new Date(lastScan.createdAt).toLocaleString()} · ${lastScan.companyCount} companies found`
    : "No scans run yet";

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Sourcing Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">{lastScanLabel}</p>
        </div>
        <Button disabled>Run scan</Button>
      </div>
      <QueueTable companies={companies} />
    </main>
  );
}
