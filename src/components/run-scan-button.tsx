"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const DEFAULT_QUERY = "early-stage Vertical AI healthcare fintech 2026";

export function RunScanButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [loading, setLoading] = useState(false);

  async function handleRunScan() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Scan complete: ${data.created} new ${
            data.created === 1 ? "company" : "companies"
          } surfaced`
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(data.error ?? "Scan failed");
      }
    } catch {
      toast.error("Network error — scan failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) setOpen(v); }}>
      <DialogTrigger asChild>
        <Button>Run scan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run sourcing scan</DialogTitle>
          <DialogDescription>
            The agent searches for Vertical AI companies, then generates a
            profile and thesis assessment for each result. This may take{" "}
            <strong>60–90 seconds</strong> while the agent processes each
            candidate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Search query
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            placeholder="e.g. early-stage Vertical AI healthcare 2026"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleRunScan}
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                Running…
              </>
            ) : (
              "Run scan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
