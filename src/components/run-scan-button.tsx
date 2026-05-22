"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, Sparkles, CheckCircle2, X, XCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const DEFAULT_QUERY = "AI healthcare startup raised seed Series A";

type LogEntry =
  | { type: "constraints"; verticals: string[]; stages: string[]; timeLabel: string }
  | { type: "iteration"; iteration: number; query: string; reasoning: string }
  | { type: "found"; company: string; vertical: string | null; stage: string | null; score: number | null }
  | { type: "skipped"; url: string; reason: string }
  | { type: "complete"; created: number; skipped: number; scanRunId: string }
  | { type: "error"; message: string }
  | { type: "cancelled"; found: number };

export function RunScanButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);
  const [runMode, setRunMode] = useState<"live" | "background">("live");
  const [cancelling, setCancelling] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  function appendLog(entry: LogEntry) {
    setLog((prev) => [...prev, entry]);
  }

  async function handleRunScan() {
    if (!query.trim()) return;
    setLoading(true);
    setDone(false);
    setLog([]);
    setCancelling(false);

    if (runMode === "background") {
      setOpen(false);
      toast("Scan running in background — new companies will appear in the queue automatically", {
        duration: 5000,
      });
      sessionStorage.setItem("scanRunning", "true");

      const capturedQuery = query.trim();
      fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: capturedQuery }),
      }).then(async (res) => {
        if (!res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let companiesFound = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as LogEntry;
              appendLog(event);
              if (event.type === "found") companiesFound++;
              if (event.type === "complete") companiesFound = event.created;
            } catch {}
          }
        }

        sessionStorage.setItem("scanResult", JSON.stringify({
          completed: true,
          found: companiesFound,
          query: capturedQuery,
          completedAt: new Date().toISOString(),
        }));
        sessionStorage.removeItem("scanRunning");

        if (pathname === "/") {
          router.refresh();
        }

        if (Notification.permission === "granted") {
          new Notification("Proofpoint Sourcing", {
            body: companiesFound > 0
              ? `Scan complete — ${companiesFound} new ${companiesFound === 1 ? "company" : "companies"} added to your queue`
              : "Scan complete — no new companies matched your criteria",
            icon: "/proofpoint-logo.webp",
          });
        }
      }).catch(() => {
        sessionStorage.removeItem("scanRunning");
        sessionStorage.setItem("scanResult", JSON.stringify({
          completed: false,
          found: 0,
          error: true,
        }));
      }).finally(() => {
        setLoading(false);
      });

      return;
    }

    // Live mode
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        toast.error("Scan failed");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as LogEntry;
              appendLog(event);

              if (event.type === "complete") {
                setDone(true);
                toast.success(
                  `Scan complete — ${event.created} ${
                    event.created === 1 ? "company" : "companies"
                  } found`
                );
                router.refresh();
              }

              if (event.type === "error") {
                toast.error(event.message);
              }
            } catch {
              // malformed SSE event, skip
            }
          }
        }
      } catch (readErr: unknown) {
        const err = readErr as { name?: string };
        if (err?.name === "AbortError") {
          setLog((prev) => {
            const foundCount = prev.filter((e) => e.type === "found").length;
            return [...prev, { type: "cancelled", found: foundCount } as LogEntry];
          });
          router.refresh();
        } else {
          toast.error("Network error — scan failed");
        }
      }
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e?.name !== "AbortError") {
        toast.error("Network error — scan failed");
      }
    } finally {
      setLoading(false);
      setCancelling(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancelScan() {
    if (abortControllerRef.current) {
      setCancelling(true);
      abortControllerRef.current.abort();
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    // Only reset state if no scan is running
    if (!v && !loading) {
      setLog([]);
      setDone(false);
    }
  }

  function handleRunModeChange(mode: "live" | "background") {
    setRunMode(mode);
    if (mode === "background" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  useEffect(() => {
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("openRunScan", handleOpenEvent);
    return () => window.removeEventListener("openRunScan", handleOpenEvent);
  }, []);

  const showLog = log.length > 0;

  function describeSearch(reasoning: string, iteration: number, query?: string): string {
    const lower = (reasoning + " " + (query ?? "")).toLowerCase();
    if (lower.includes("fintech") || lower.includes("insurance") || lower.includes("financial") || lower.includes("underwriting") || lower.includes("lending") || lower.includes("banking") || lower.includes("payments")) {
      return "Searching fintech funding news…";
    }
    if (lower.includes("life sciences") || lower.includes("biotech") || lower.includes("pharma") || lower.includes("genomics") || lower.includes("drug discovery")) {
      return "Searching life sciences…";
    }
    if (lower.includes("healthcare") || lower.includes("clinical") || lower.includes("health") || lower.includes("medical") || lower.includes("patient")) {
      return "Searching healthcare funding news…";
    }
    return "Searching for companies…";
  }

  function countVerticals(entries: LogEntry[]): number {
    const verticals = new Set(
      entries
        .filter(e => e.type === "found" && e.vertical)
        .map(e => (e as { type: "found"; vertical: string | null }).vertical)
    );
    return Math.max(1, verticals.size);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          onClick={() => setOpen(true)}
          className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white shadow-none border-0 transition-all duration-200 hover:scale-[1.03] hover:shadow-md font-medium px-5 py-2.5 text-sm"
        >
          {loading && !open ? (
            <>
              <Loader2Icon className="size-4 mr-2 animate-spin" />
              Scan running…
            </>
          ) : (
            <>
              <Sparkles className="size-4 mr-2" />
              Run scan
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-medium tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-[var(--proofpoint-orange)]" />
            Run sourcing scan
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            The agent searches the web across multiple queries, filters for Vertical AI companies matching Proofpoint&apos;s thesis, and generates a profile and thesis assessment for each result. This may take <strong className="text-foreground font-medium">60–90 seconds</strong>.
          </DialogDescription>
        </DialogHeader>

        {!showLog && !loading && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Search intent
              </label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                placeholder="e.g. AI healthcare startup raised seed"
                className="border-0 border-b border-border rounded-none bg-transparent px-0 py-2 focus-visible:ring-0 focus-visible:border-foreground transition-colors"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-muted-foreground">Run mode:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunModeChange("live")}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md border transition-colors",
                    runMode === "live"
                      ? "border-[var(--proofpoint-orange)] text-[var(--proofpoint-orange)] bg-[var(--proofpoint-orange)]/8"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  )}
                >
                  Watch live
                </button>
                <button
                  onClick={() => handleRunModeChange("background")}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md border transition-colors",
                    runMode === "background"
                      ? "border-[var(--proofpoint-orange)] text-[var(--proofpoint-orange)] bg-[var(--proofpoint-orange)]/8"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  )}
                >
                  Run in background
                </button>
              </div>
            </div>
          </div>
        )}

        {showLog && (
          <div className="max-h-80 overflow-y-auto space-y-3 py-2">
            {loading && runMode === "background" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pb-2 border-b border-border mb-1">
                <Loader2Icon className="size-3 animate-spin shrink-0" />
                Scan running in background — results appear in queue as they are found
              </div>
            )}
            {log.map((entry, i) => {
              if (entry.type === "constraints") {
                const pills: string[] = [
                  ...entry.verticals,
                  ...entry.stages,
                  entry.timeLabel,
                ];
                return (
                  <div key={i} className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-border">
                    {pills.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center rounded-full bg-[var(--proofpoint-orange)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--proofpoint-orange)]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                );
              }

              if (entry.type === "iteration")
                return (
                  <div key={i} className="flex items-center gap-2.5 pt-2">
                    <Search className="size-3.5 text-[var(--proofpoint-orange)] shrink-0" />
                    <span className="text-sm font-medium text-foreground">
                      {describeSearch(entry.reasoning, entry.iteration, entry.query)}
                    </span>
                  </div>
                );

              if (entry.type === "found")
                return (
                  <div key={i} className="flex items-center justify-between gap-4 pl-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-foreground text-sm">{entry.company}</span>
                      {entry.vertical && (
                        <span className="text-xs text-muted-foreground">{entry.vertical}</span>
                      )}
                      {entry.stage && (
                        <span className="text-xs text-muted-foreground">· {entry.stage}</span>
                      )}
                    </div>
                    {entry.score != null && (
                      <span className="text-sm font-semibold tabular-nums shrink-0">
                        {entry.score}<span className="text-xs font-normal text-muted-foreground">/10</span>
                      </span>
                    )}
                  </div>
                );

              if (entry.type === "complete")
                return (
                  <div key={i} className="flex items-center gap-2 pt-3 border-t border-border mt-1">
                    <Sparkles className="size-4 text-[var(--proofpoint-orange)] shrink-0" />
                    <span className="text-sm font-medium text-foreground">
                      Found {entry.created} {entry.created === 1 ? "company" : "companies"} across {countVerticals(log)} {countVerticals(log) === 1 ? "vertical" : "verticals"}
                    </span>
                  </div>
                );

              if (entry.type === "error")
                return (
                  <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="size-4 shrink-0" />
                    {entry.message}
                  </div>
                );

              if (entry.type === "cancelled")
                return (
                  <div key={i} className="flex items-center gap-2 pt-3 border-t border-border mt-1 text-sm text-muted-foreground">
                    <X className="size-4 shrink-0" />
                    Scan cancelled —{" "}
                    {entry.found > 0
                      ? `${entry.found} ${entry.found === 1 ? "company" : "companies"} found so far added to queue`
                      : "no companies found before cancellation"}
                  </div>
                );

              // skipped entries are not shown to the analyst
              return null;
            })}
            {loading && runMode === "live" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-3">
                <Loader2Icon className="size-4 animate-spin shrink-0" />
                Searching...
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button
              onClick={() => handleOpenChange(false)}
              className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white"
            >
              Done
            </Button>
          ) : loading && runMode === "background" ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2Icon className="size-3.5 animate-spin" />
                Scanning in background…
              </span>
              <Button
                variant="outline"
                onClick={handleCancelScan}
                disabled={cancelling}
                className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive text-sm"
              >
                {cancelling ? "Cancelling…" : "Cancel scan"}
              </Button>
            </div>
          ) : (
            <>
              {loading ? (
                <Button
                  variant="outline"
                  onClick={handleCancelScan}
                  disabled={cancelling}
                  className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                >
                  {cancelling ? (
                    <>
                      <Loader2Icon className="size-3.5 mr-2 animate-spin" />
                      Cancelling…
                    </>
                  ) : (
                    "Cancel scan"
                  )}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleRunScan}
                disabled={loading || !query.trim()}
                className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white border-0 shadow-none disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2Icon className="size-3.5 mr-2 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5 mr-2" />
                    Run scan
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
