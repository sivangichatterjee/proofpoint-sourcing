import { db } from "@/lib/db";
import { QueueTable } from "@/components/queue-table";
import { RunScanButton } from "@/components/run-scan-button";

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

  const scanMode = process.env.SCAN_MODE ?? "mock";

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold">Sourcing Queue</h1>
          <p className="text-sm text-muted-foreground">{lastScanLabel}</p>
          {scanMode === "mock" ? (
            <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-300">
              Mock mode — using fixture data
            </span>
          ) : (
            <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300">
              Live mode — using Tavily web search
            </span>
          )}
        </div>
        <RunScanButton />
      </div>
      <QueueTable companies={companies} />
    </main>
  );
}
