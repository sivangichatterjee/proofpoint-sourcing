import Image from "next/image";
import { db } from "@/lib/db";
import { QueueTable } from "@/components/queue-table";
import { RunScanButton } from "@/components/run-scan-button";
import { ScanBanner } from "@/components/scan-banner";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [companies, lastScan] = await Promise.all([
    db.company.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        website: true,
        oneLiner: true,
        vertical: true,
        stage: true,
        status: true,
        nextStep: true,
        thesisFit: true,
        createdAt: true,
      },
    }),
    db.scanRun.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  const scanMode = process.env.SCAN_MODE ?? "mock";

  const subtitle = lastScan
    ? `Vertical AI deal flow · Updated ${new Date(lastScan.createdAt).toLocaleString()} · ${companies.length} ${companies.length === 1 ? "company" : "companies"}`
    : `Vertical AI deal flow · ${companies.length} ${companies.length === 1 ? "company" : "companies"}`;

  return (
    <>
      {/* ── Branding bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-background py-3">
        <div className="px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/proofpoint-logo.webp"
              width={140}
              height={36}
              priority
              alt="Proofpoint Capital"
              className="h-8 w-auto"
            />
            <span className="text-sm font-sans font-medium text-[var(--proofpoint-orange)]">
              Sourcing Tool
            </span>
          </div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Internal
          </span>
        </div>
      </div>
      <ScanBanner />

      <main className="container mx-auto max-w-7xl px-6 py-10">
        <div className="border-b border-border pb-8 mb-8">
          <div className="flex items-baseline justify-between gap-6">
            <div>
              <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground leading-tight">
                Sourcing Queue
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              {scanMode === "mock" ? (
                <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Mock data
                </span>
              ) : (
                <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              )}
              <RunScanButton />
            </div>
          </div>
        </div>
        <QueueTable companies={companies} />
      </main>
    </>
  );
}
