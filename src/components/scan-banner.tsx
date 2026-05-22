"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sparkles, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ScanResult = {
  completed?: boolean;
  found: number;
  query?: string;
  error?: boolean;
};

export function ScanBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [scanBanner, setScanBanner] = useState<ScanResult | null>(null);

  // Check on mount for a result that arrived before this component rendered
  useEffect(() => {
    const result = sessionStorage.getItem("scanResult");
    if (result) {
      try {
        const parsed = JSON.parse(result) as ScanResult;
        if (parsed.completed || parsed.error) {
          setScanBanner(parsed);
          sessionStorage.removeItem("scanResult");
        }
      } catch {}
    }
  }, []);

  // Poll while a background scan is running
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        pathname === "/" &&
        sessionStorage.getItem("scanRunning") === "true"
      ) {
        router.refresh();
      }
      // Always check for a completed result
      const result = sessionStorage.getItem("scanResult");
      if (result) {
        try {
          const parsed = JSON.parse(result) as ScanResult;
          if (parsed.completed || parsed.error) {
            setScanBanner(parsed);
            sessionStorage.removeItem("scanResult");
          }
        } catch {}
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [router, pathname]);

  if (!scanBanner) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-3 border-b text-sm",
        scanBanner.error
          ? "bg-destructive/5 border-destructive/20 text-destructive"
          : scanBanner.found === 0
            ? "bg-muted/50 border-border text-muted-foreground"
            : "bg-[var(--proofpoint-orange)]/5 border-[var(--proofpoint-orange)]/20 text-foreground"
      )}
    >
      <div className="flex items-center gap-2">
        {scanBanner.error ? (
          <AlertCircle className="size-4 shrink-0 text-destructive" />
        ) : (
          <Sparkles className="size-4 shrink-0 text-[var(--proofpoint-orange)]" />
        )}
        <span>
          {scanBanner.error
            ? "Background scan failed — please try again"
            : scanBanner.found === 0
              ? `Scan complete — no new companies matched${scanBanner.query ? ` "${scanBanner.query}"` : ""}. Try a broader query.`
              : `Scan complete — ${scanBanner.found} new ${scanBanner.found === 1 ? "company" : "companies"} added to your queue`
          }
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {scanBanner.found === 0 && !scanBanner.error && (
          <button
            onClick={() => {
              setScanBanner(null);
              window.dispatchEvent(new CustomEvent("openRunScan"));
            }}
            className="text-sm font-medium text-[var(--proofpoint-orange)] hover:underline"
          >
            Run another scan
          </button>
        )}
        <button
          onClick={() => setScanBanner(null)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
