"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, Sparkles, CheckCircle2, X, XCircle, Search } from "lucide-react";
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
const SCAN_RUNNING_KEY = "scanRunning";
const SCAN_QUERY_KEY = "scanQuery";
const SCAN_PROGRESS_LABEL_KEY = "scanProgressLabel";
const SCAN_RESULT_KEY = "scanResult";
const SCAN_LOG_KEY = "scanLog";
const SCAN_STARTED_AT_KEY = "scanStartedAt";

let activeScanController: AbortController | null = null;

type LogEntry =
  | {
      type: "constraints";
      verticals: string[];
      stages: string[];
      stageLabels?: string[];
      geographies?: string[];
      focusTerms?: string[];
      timeLabel: string;
    }
  | { type: "iteration"; iteration: number; query: string; reasoning: string }
  | { type: "found"; company: string; vertical: string | null; stage: string | null; score: number | null }
  | { type: "skipped"; url: string; reason: string }
  | { type: "complete"; created: number; skipped: number; scanRunId: string }
  | { type: "error"; message: string }
  | { type: "cancelled"; found: number };

type PersistedScanResult = {
  completed?: boolean;
  found: number;
  query?: string;
  error?: boolean;
  completedAt?: string;
};

export function RunScanButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [persistedRunning, setPersistedRunning] = useState(false);
  const [persistedProgressLabel, setPersistedProgressLabel] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scanIsRunning = loading || persistedRunning;

  function readPersistedLog(): LogEntry[] {
    const persisted = sessionStorage.getItem(SCAN_LOG_KEY);
    if (!persisted) return [];
    try {
      return JSON.parse(persisted) as LogEntry[];
    } catch {
      return [];
    }
  }

  function appendLog(entry: LogEntry) {
    const next = [...readPersistedLog(), entry];
    sessionStorage.setItem(SCAN_LOG_KEY, JSON.stringify(next));
    setLog(next);
    if (entry.type === "complete") {
      setDone(true);
    }
  }

  function clearPersistedScanState() {
    sessionStorage.removeItem(SCAN_RUNNING_KEY);
    sessionStorage.removeItem(SCAN_PROGRESS_LABEL_KEY);
    sessionStorage.removeItem(SCAN_QUERY_KEY);
    sessionStorage.removeItem(SCAN_STARTED_AT_KEY);
  }

  function clearPersistedCompletedState() {
    sessionStorage.removeItem(SCAN_LOG_KEY);
    sessionStorage.removeItem(SCAN_RESULT_KEY);
  }

  function resetLocalScanState() {
    setLog([]);
    setDone(false);
  }

  function hasPersistedCompletedScan(): boolean {
    const persistedResult = sessionStorage.getItem(SCAN_RESULT_KEY);
    if (!persistedResult) return false;
    try {
      const parsed = JSON.parse(persistedResult) as PersistedScanResult;
      return Boolean(parsed.completed || parsed.error);
    } catch {
      return false;
    }
  }

  function syncFromSessionStorage() {
    const running = sessionStorage.getItem(SCAN_RUNNING_KEY) === "true";
    setPersistedRunning(running);
    setPersistedProgressLabel(sessionStorage.getItem(SCAN_PROGRESS_LABEL_KEY));

    const runningQuery = sessionStorage.getItem(SCAN_QUERY_KEY);
    if (runningQuery) setQuery(runningQuery);

    const persistedLog = sessionStorage.getItem(SCAN_LOG_KEY);
    let parsedLog: LogEntry[] = [];
    if (persistedLog) {
      try {
        parsedLog = JSON.parse(persistedLog) as LogEntry[];
        setLog(parsedLog);
        setDone(parsedLog.some((entry) => entry.type === "complete"));
      } catch {
        // ignore malformed persisted log
      }
    }

    const persistedResult = sessionStorage.getItem(SCAN_RESULT_KEY);
    if (persistedResult) {
      try {
        const parsed = JSON.parse(persistedResult) as PersistedScanResult;
        if (parsed.completed || parsed.error) {
          setDone(Boolean(parsed.completed));
          if (parsed.completed && !parsedLog.some((entry) => entry.type === "complete")) {
            const next = [
              ...parsedLog,
              { type: "complete", created: parsed.found, skipped: 0, scanRunId: "" } as LogEntry,
            ];
            sessionStorage.setItem(SCAN_LOG_KEY, JSON.stringify(next));
            setLog(next);
          }
        }
      } catch {
        // ignore malformed persisted result
      }
    }
  }

  async function handleRunScan() {
    if (!query.trim()) return;
    if (sessionStorage.getItem(SCAN_RUNNING_KEY) === "true") {
      setPersistedRunning(true);
      syncFromSessionStorage();
      toast("A scan is already running in the background");
      return;
    }
    setLoading(true);
    setPersistedRunning(true);
    setDone(false);
    setLog([]);
    setCancelling(false);
    clearPersistedCompletedState();
    sessionStorage.setItem(SCAN_RUNNING_KEY, "true");
    sessionStorage.setItem(SCAN_QUERY_KEY, query.trim());
    sessionStorage.setItem(SCAN_PROGRESS_LABEL_KEY, "Starting scan…");
    sessionStorage.setItem(SCAN_STARTED_AT_KEY, new Date().toISOString());
    sessionStorage.setItem(SCAN_LOG_KEY, JSON.stringify([]));
    setPersistedProgressLabel("Starting scan…");
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    activeScanController = controller;
    const capturedQuery = query.trim();

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: capturedQuery }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        toast.error("Scan failed");
        clearPersistedScanState();
        setPersistedRunning(false);
        sessionStorage.setItem(SCAN_RESULT_KEY, JSON.stringify({
          completed: false,
          found: 0,
          error: true,
        }));
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
              if (event.type === "iteration") {
                const progressLabel = describeSearch(event.reasoning, event.iteration, event.query);
                sessionStorage.setItem(SCAN_PROGRESS_LABEL_KEY, progressLabel);
                setPersistedProgressLabel(progressLabel);
              }

              if (event.type === "complete") {
                setDone(true);
                clearPersistedScanState();
                setPersistedProgressLabel(null);
                setPersistedRunning(false);
                sessionStorage.setItem(SCAN_RESULT_KEY, JSON.stringify({
                  completed: true,
                  found: event.created,
                  query: capturedQuery,
                  completedAt: new Date().toISOString(),
                }));
                toast.success(
                  `Scan complete — ${event.created} ${
                    event.created === 1 ? "company" : "companies"
                  } found`
                );
                router.refresh();
                if (Notification.permission === "granted") {
                  new Notification("Proofpoint Sourcing", {
                    body: event.created > 0
                      ? `Scan complete — ${event.created} new ${event.created === 1 ? "company" : "companies"} added to your queue`
                      : "Scan complete — no new companies matched your criteria",
                    icon: "/proofpoint-logo.webp",
                  });
                }
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
          clearPersistedScanState();
          setPersistedProgressLabel(null);
          setPersistedRunning(false);
          const currentLog = readPersistedLog();
          const foundCount = currentLog.filter((e) => e.type === "found").length;
          const next = [...currentLog, { type: "cancelled", found: foundCount } as LogEntry];
          sessionStorage.setItem(SCAN_LOG_KEY, JSON.stringify(next));
          setLog(next);
          router.refresh();
        } else {
          clearPersistedScanState();
          setPersistedProgressLabel(null);
          setPersistedRunning(false);
          sessionStorage.setItem(SCAN_RESULT_KEY, JSON.stringify({
            completed: false,
            found: 0,
            error: true,
          }));
          toast.error("Network error — scan failed");
        }
      }
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e?.name !== "AbortError") {
        clearPersistedScanState();
        setPersistedProgressLabel(null);
        setPersistedRunning(false);
        sessionStorage.setItem(SCAN_RESULT_KEY, JSON.stringify({
          completed: false,
          found: 0,
          error: true,
        }));
        toast.error("Network error — scan failed");
      }
    } finally {
      setLoading(false);
      setCancelling(false);
      if (activeScanController === controller) {
        activeScanController = null;
      }
      abortControllerRef.current = null;
    }
  }

  function handleCancelScan() {
    const controller = abortControllerRef.current ?? activeScanController;
    if (controller) {
      setCancelling(true);
      controller.abort();
      return;
    }
    clearPersistedScanState();
    setPersistedRunning(false);
    setPersistedProgressLabel(null);
    toast("Cleared stale scan state");
  }

  function handleOpenChange(v: boolean) {
    if (v && !scanIsRunning && hasPersistedCompletedScan()) {
      clearPersistedCompletedState();
      resetLocalScanState();
    }
    setOpen(v);
    if (!v && loading) {
      toast("Scan running in background — new companies will appear in the queue automatically", {
        duration: 5000,
      });
    }
    // Only reset state if no scan is running and there is no completed run to review.
    if (!v && !scanIsRunning && !done) {
      resetLocalScanState();
      clearPersistedCompletedState();
    }
  }

  function handleDismissCompletedScan() {
    clearPersistedCompletedState();
    resetLocalScanState();
    setOpen(false);
  }

  useEffect(() => {
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("openRunScan", handleOpenEvent);
    return () => window.removeEventListener("openRunScan", handleOpenEvent);
  }, []);

  useEffect(() => {
    syncFromSessionStorage();
    const interval = window.setInterval(syncFromSessionStorage, 2000);
    window.addEventListener("storage", syncFromSessionStorage);
    window.addEventListener("focus", syncFromSessionStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", syncFromSessionStorage);
      window.removeEventListener("focus", syncFromSessionStorage);
    };
  }, []);

  const showLog = log.length > 0;

  function describeSearch(_reasoning: string, _iteration: number, _query?: string): string {
    return "Searching related companies…";
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
          {scanIsRunning && !open ? (
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
            Search the web, filter for Proofpoint-aligned Vertical AI companies, and generate profiles plus thesis assessments. Usually takes <strong className="text-foreground font-medium">60–90 seconds</strong>.
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
                disabled={scanIsRunning}
                placeholder="e.g. AI healthcare startup raised seed"
                className="border-0 border-b border-border rounded-none bg-transparent px-0 py-2 focus-visible:ring-0 focus-visible:border-foreground transition-colors"
              />
            </div>
          </div>
        )}

        {showLog && (
          <div className="max-h-80 overflow-y-auto space-y-3 py-2">
            {log.map((entry, i) => {
              if (entry.type === "constraints") {
                const pills: string[] = [
                  ...entry.verticals,
                  ...(entry.stageLabels ?? entry.stages),
                  ...(entry.geographies ?? []),
                  ...(entry.focusTerms ?? []),
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
                return (() => {
                  const displayVertical = entry.vertical ?? "-";
                  const displayStage = entry.stage ?? "-";

                  return (
                    <div key={i} className="flex items-center justify-between gap-4 pl-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-foreground text-sm">{entry.company}</span>
                        <span className="text-xs text-muted-foreground">{displayVertical}</span>
                        <span className="text-xs text-muted-foreground">· {displayStage}</span>
                      </div>
                      {entry.score != null && (
                        <span className="text-sm font-semibold tabular-nums shrink-0">
                          {entry.score}<span className="text-xs font-normal text-muted-foreground">/10</span>
                        </span>
                      )}
                    </div>
                  );
                })();

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
            {loading && (
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
              onClick={handleDismissCompletedScan}
              className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white"
            >
              Done
            </Button>
          ) : scanIsRunning && !loading ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2Icon className="size-3.5 animate-spin" />
                {persistedProgressLabel ?? "Scan running in background…"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelScan}
                  disabled={cancelling}
                  className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                >
                  {cancelling ? "Cancelling…" : "Cancel scan"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Close
                </Button>
              </div>
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
                disabled={scanIsRunning || !query.trim()}
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
