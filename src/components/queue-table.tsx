"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  ListFilter,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import type { CompanyStatus } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_ORDER = [
  "Pre-seed",
  "Stealth",
  "Seed",
  "Series A",
  "Series B",
  "Series C",
  "Series D",
  "Series E",
  "Series F",
];

const stageRank = (s: string | null) =>
  s === null
    ? 999
    : STAGE_ORDER.indexOf(s) === -1
    ? 998
    : STAGE_ORDER.indexOf(s);

const STATUS_PRIORITY: Record<string, number> = {
  PRIORITY_FOLLOW_UP: 0,
  REVIEWING: 1,
  NEW: 2,
  PASS: 3,
};

const ALL_STATUSES: CompanyStatus[] = [
  "PRIORITY_FOLLOW_UP",
  "REVIEWING",
  "NEW",
  "PASS",
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type CompanyRow = {
  id: string;
  name: string;
  website: string | null;
  oneLiner: string | null;
  vertical: string | null;
  stage: string | null;
  status: string;
  nextStep: string | null;
  thesisFit: string | null;
  createdAt: Date;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseScore(thesisFit: string | null): number | null {
  if (!thesisFit) return null;
  try {
    const parsed = JSON.parse(thesisFit);
    return typeof parsed.score === "number" ? parsed.score : null;
  } catch {
    return null;
  }
}

const QUEUE_BADGE_STYLES: Record<CompanyStatus, string> = {
  PRIORITY_FOLLOW_UP: "bg-emerald-100 text-emerald-900 border border-emerald-300",
  REVIEWING: "bg-amber-100 text-amber-900 border border-amber-300",
  NEW: "bg-blue-100 text-blue-900 border border-blue-300",
  PASS: "bg-zinc-200 text-zinc-800 border border-zinc-300",
};

const QUEUE_STATUS_LABELS: Record<CompanyStatus, string> = {
  PRIORITY_FOLLOW_UP: "PRIORITY FOLLOW-UP",
  REVIEWING: "REVIEWING",
  NEW: "NEW",
  PASS: "PASS",
};

// ── FilterPopover ─────────────────────────────────────────────────────────────

function FilterPopover({
  options,
  excluded,
  onExcludedChange,
  renderOption,
}: {
  options: string[];
  excluded: Set<string>;
  onExcludedChange: (next: Set<string>) => void;
  renderOption?: (opt: string) => React.ReactNode;
}) {
  const isActive = excluded.size > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center rounded p-0.5 hover:bg-muted transition-colors"
          aria-label="Filter column"
        >
          <ListFilter
            className={cn(
              "size-4 ml-1.5",
              isActive ? "text-[var(--proofpoint-orange)]" : "text-muted-foreground/60"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 gap-0 p-1.5" align="start">
        <div className="max-h-52 overflow-y-auto space-y-0.5">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-1.5 py-1 rounded text-sm hover:bg-muted cursor-pointer select-none"
            >
              <input
                type="checkbox"
                className="size-3 rounded"
                checked={!excluded.has(opt)}
                onChange={(e) => {
                  const next = new Set(excluded);
                  if (e.target.checked) next.delete(opt);
                  else next.add(opt);
                  onExcludedChange(next);
                }}
              />
              {renderOption ? renderOption(opt) : <span>{opt}</span>}
            </label>
          ))}
        </div>
        {isActive && (
          <button
            onClick={() => onExcludedChange(new Set())}
            className="mt-1.5 text-xs text-primary hover:underline block w-full text-left px-1.5 py-0.5"
          >
            Clear filter
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── ResizeHandle ──────────────────────────────────────────────────────────────

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const startX = useRef<number | null>(null);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    startX.current = e.clientX;

    function onMouseMove(ev: MouseEvent) {
      if (startX.current === null) return;
      const delta = ev.clientX - startX.current;
      startX.current = ev.clientX;
      onResize(delta);
    }

    function onMouseUp() {
      startX.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--proofpoint-orange)]/40 transition-colors select-none z-10"
    />
  );
}

// ── QueueTable ────────────────────────────────────────────────────────────────

function display(value: string | null | undefined): string {
  if (!value || value === "null" || value === "undefined") return "—";
  return value;
}

export function QueueTable({ companies }: { companies: CompanyRow[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{
    column: string;
    direction: "asc" | "desc";
  } | null>({ column: "thesisFitScore", direction: "desc" });
  const [excludedVerticals, setExcludedVerticals] = useState<Set<string>>(
    new Set()
  );
  const [excludedStages, setExcludedStages] = useState<Set<string>>(new Set());
  const [excludedStatuses, setExcludedStatuses] = useState<Set<string>>(
    new Set()
  );
  const [colWidths, setColWidths] = useState({
    company: 600,
    vertical: 180,
    stage: 120,
    status: 150,
    score: 90,
  });
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [tableWidth, setTableWidth] = useState<number | null>(null);

  const MIN_COL_WIDTHS = useMemo(
    () => ({
      company: 300,
      vertical: 120,
      stage: 100,
      status: 110,
      score: 90,
    }),
    []
  );

  useEffect(() => {
    const node = tableWrapRef.current;
    if (!node) return;

    const update = () => setTableWidth(node.clientWidth);
    update();

    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!tableWidth) return;

    setColWidths((prev) => {
      const total =
        prev.company + prev.vertical + prev.stage + prev.status + prev.score;

      if (total <= tableWidth) return prev;

      const next = { ...prev };
      let overflow = total - tableWidth;
      const shrinkableKeys: Array<keyof typeof next> = [
        "company",
        "vertical",
        "stage",
        "status",
      ];

      while (overflow > 0.5) {
        const candidates = shrinkableKeys.filter(
          (key) => next[key] > MIN_COL_WIDTHS[key]
        );
        if (candidates.length === 0) break;

        const share = overflow / candidates.length;
        let reduced = 0;

        for (const key of candidates) {
          const room = next[key] - MIN_COL_WIDTHS[key];
          const delta = Math.min(room, Math.max(1, share));
          next[key] -= delta;
          reduced += delta;
        }

        if (reduced === 0) break;
        overflow -= reduced;
      }

      return next;
    });
  }, [MIN_COL_WIDTHS, tableWidth]);

  const resizeColumn = (
    key: keyof typeof colWidths,
    delta: number,
    minWidth: number
  ) => {
    setColWidths((prev) => {
      const next = { ...prev };
      const total =
        prev.company + prev.vertical + prev.stage + prev.status + prev.score;
      const slack = tableWidth ? Math.max(0, tableWidth - total) : 0;

      if (key === "company") {
        const maxWidth = tableWidth
          ? Math.max(
              minWidth,
              tableWidth - (prev.vertical + prev.stage + prev.status + prev.score)
            )
          : Number.POSITIVE_INFINITY;

        next.company = Math.min(
          maxWidth,
          Math.max(minWidth, prev.company + delta)
        );
        return next;
      }

      if (delta >= 0) {
        const companyRoom = Math.max(
          0,
          prev.company - MIN_COL_WIDTHS.company
        );
        const allowedGrowth = slack + companyRoom;
        const effectiveDelta = Math.min(delta, allowedGrowth);
        const growthFromSlack = Math.min(slack, effectiveDelta);
        const growthFromCompany = effectiveDelta - growthFromSlack;

        next[key] = Math.max(minWidth, prev[key] + effectiveDelta);
        next.company = Math.max(
          MIN_COL_WIDTHS.company,
          prev.company - growthFromCompany
        );
        return next;
      }

      next[key] = Math.max(minWidth, prev[key] + delta);

      return next;
    });
  };

  const totalColWidth =
    colWidths.company +
    colWidths.vertical +
    colWidths.stage +
    colWidths.status +
    colWidths.score;

  // ── Filter option lists (derived from live data) ────────────────────────────
  const allVerticals = useMemo(() => {
    const vals = new Set<string>();
    companies.forEach((c) => vals.add(c.vertical ?? "(no vertical)"));
    return Array.from(vals).sort((a, b) => {
      if (a === "(no vertical)") return 1;
      if (b === "(no vertical)") return -1;
      return a.localeCompare(b);
    });
  }, [companies]);

  const allStages = useMemo(() => {
    const vals = new Set<string>();
    companies.forEach((c) => vals.add(c.stage ?? "(no stage)"));
    return Array.from(vals).sort((a, b) => {
      if (a === "(no stage)") return 1;
      if (b === "(no stage)") return -1;
      return stageRank(a) - stageRank(b);
    });
  }, [companies]);

  // ── Sort ────────────────────────────────────────────────────────────────────
  const toggleSort = (column: string) => {
    setSort((prev) => {
      if (prev?.column !== column) return { column, direction: "desc" };
      if (prev.direction === "desc") return { column, direction: "asc" };
      return null;
    });
  };

  const sortIcon = (column: string) => {
    if (sort?.column !== column)
      return <ArrowUpDown className="size-3.5 text-muted-foreground/40" />;
    return sort.direction === "desc" ? (
      <ArrowDown className="size-3.5 text-[var(--proofpoint-orange)]" />
    ) : (
      <ArrowUp className="size-3.5 text-[var(--proofpoint-orange)]" />
    );
  };

  // ── Filtered + sorted rows ──────────────────────────────────────────────────
  const displayed = useMemo(() => {
    const q = search.toLowerCase();

    const filtered = companies.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.vertical ?? "").toLowerCase().includes(q);

      const matchesVertical =
        excludedVerticals.size === 0 ||
        !excludedVerticals.has(c.vertical ?? "(no vertical)");
      const matchesStage =
        excludedStages.size === 0 ||
        !excludedStages.has(c.stage ?? "(no stage)");
      const matchesStatus =
        excludedStatuses.size === 0 || !excludedStatuses.has(c.status);

      return matchesSearch && matchesVertical && matchesStage && matchesStatus;
    });

    if (!sort) return filtered;

    return [...filtered].sort((a, b) => {
      const dir = sort.direction === "desc" ? -1 : 1;
      switch (sort.column) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "vertical": {
          if (a.vertical === null && b.vertical === null) return 0;
          if (a.vertical === null) return 1;
          if (b.vertical === null) return -1;
          return dir * a.vertical.localeCompare(b.vertical);
        }
        case "stage": {
          const ra = stageRank(a.stage);
          const rb = stageRank(b.stage);
          if (ra >= 998 && rb >= 998) return 0;
          if (ra >= 998) return 1;
          if (rb >= 998) return -1;
          return dir * (ra - rb);
        }
        case "status": {
          const pa = STATUS_PRIORITY[a.status] ?? 99;
          const pb = STATUS_PRIORITY[b.status] ?? 99;
          return dir * (pa - pb);
        }
        case "thesisFitScore": {
          const sa = parseScore(a.thesisFit);
          const sb = parseScore(b.thesisFit);
          if (sa === null && sb === null) return 0;
          if (sa === null) return 1;
          if (sb === null) return -1;
          return dir * (sa - sb);
        }
        default:
          return 0;
      }
    });
  }, [
    companies,
    search,
    excludedVerticals,
    excludedStages,
    excludedStatuses,
    sort,
  ]);

  // ── Column header helpers ───────────────────────────────────────────────────
  const thClass =
    "text-base font-medium uppercase tracking-[0.08em] text-muted-foreground pb-3";

  const sortBtn = (column: string, label: string) => (
    <button
      onClick={() => toggleSort(column)}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      {sortIcon(column)}
    </button>
  );

  return (
    <div ref={tableWrapRef}>
      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-border pb-3 mb-6">
        <Search className="size-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search companies, verticals, or notes…"
          className="flex-1 bg-transparent border-0 outline-none placeholder:text-muted-foreground text-sm focus:ring-0"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {displayed.length} {displayed.length === 1 ? "company" : "companies"}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <Table
        className="table-fixed"
        style={{ width: tableWidth ? Math.max(tableWidth, totalColWidth) : "100%" }}
      >
        <TableHeader>
          <TableRow>
            {/* Company */}
            <TableHead
              style={{ width: colWidths.company, minWidth: 200, position: "relative" }}
              className={thClass}
            >
              {sortBtn("name", "Company")}
              <ResizeHandle
                onResize={(delta) => resizeColumn("company", delta, 300)}
              />
            </TableHead>

            {/* Vertical */}
            <TableHead
              style={{ width: colWidths.vertical, minWidth: 80, position: "relative" }}
              className={thClass}
            >
              <div className="flex items-center gap-1">
                {sortBtn("vertical", "Vertical")}
                <FilterPopover
                  options={allVerticals}
                  excluded={excludedVerticals}
                  onExcludedChange={setExcludedVerticals}
                />
              </div>
              <ResizeHandle
                onResize={(delta) => resizeColumn("vertical", delta, 120)}
              />
            </TableHead>

            {/* Stage */}
            <TableHead
              style={{ width: colWidths.stage, minWidth: 80, position: "relative" }}
              className={thClass}
            >
              <div className="flex items-center gap-1">
                {sortBtn("stage", "Stage")}
                <FilterPopover
                  options={allStages}
                  excluded={excludedStages}
                  onExcludedChange={setExcludedStages}
                />
              </div>
              <ResizeHandle
                onResize={(delta) => resizeColumn("stage", delta, 100)}
              />
            </TableHead>

            {/* Status */}
            <TableHead
              style={{ width: colWidths.status, minWidth: 100, position: "relative" }}
              className={thClass}
            >
              <div className="flex items-center gap-1">
                {sortBtn("status", "Status")}
                <FilterPopover
                  options={ALL_STATUSES}
                  excluded={excludedStatuses}
                  onExcludedChange={setExcludedStatuses}
                  renderOption={(opt) => (
                    <StatusBadge status={opt as CompanyStatus} />
                  )}
                />
              </div>
              <ResizeHandle
                onResize={(delta) => resizeColumn("status", delta, 110)}
              />
            </TableHead>

            {/* Score — no ResizeHandle */}
            <TableHead
              style={{ width: colWidths.score, minWidth: 70 }}
              className={cn(thClass, "text-right")}
            >
              <div className="flex justify-end">
                {sortBtn("thesisFitScore", "Score")}
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayed.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-muted-foreground"
              >
                No companies match your filters.
              </TableCell>
            </TableRow>
          ) : (
            displayed.map((company) => {
              const score = parseScore(company.thesisFit);
              return (
                <TableRow key={company.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors cursor-pointer align-middle">
                  <TableCell style={{ width: colWidths.company }} className="py-6 align-middle min-w-0">
                    <div className="min-w-0 max-w-full">
                      <Link
                        href={`/companies/${company.id}`}
                        className="group flex items-center gap-2 min-w-0"
                      >
                        <span className="font-serif text-2xl font-semibold text-foreground truncate group-hover:text-[var(--proofpoint-orange)] transition-colors">
                          {company.name}
                        </span>
                        <ChevronRight className="size-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                      </Link>
                      {display(company.oneLiner) !== "—" && (
                        <div className="mt-1 text-lg text-muted-foreground truncate">
                          {display(company.oneLiner)}
                        </div>
                      )}
                      {display(company.nextStep) !== "—" && (
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--proofpoint-orange)]">
                          <ArrowRight className="size-3 shrink-0" />
                          <span className="truncate">{display(company.nextStep)}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell style={{ width: colWidths.vertical }} className="py-6 align-middle overflow-hidden">
                    <span className="block truncate text-lg text-foreground">{display(company.vertical)}</span>
                  </TableCell>
                  <TableCell style={{ width: colWidths.stage }} className="py-6 align-middle overflow-hidden">
                    <span className="block truncate text-lg text-foreground tabular-nums">{display(company.stage)}</span>
                  </TableCell>
                  <TableCell style={{ width: colWidths.status }} className="py-6 align-middle min-w-0">
                    <div className={cn(
                      "inline-block px-2.5 py-1 rounded-md text-xs font-medium tracking-wide uppercase border text-center break-all leading-tight",
                      QUEUE_BADGE_STYLES[company.status as CompanyStatus] ?? "bg-muted text-muted-foreground"
                    )}>
                      {QUEUE_STATUS_LABELS[company.status as CompanyStatus] ?? company.status}
                    </div>
                  </TableCell>
                  <TableCell style={{ width: colWidths.score }} className="py-6 align-middle text-right">
                    {score !== null ? (
                      <div className="flex items-baseline justify-end gap-1 tabular-nums">
                        <span className="text-3xl font-serif font-medium text-foreground">{score}</span>
                        <span className="text-xs text-muted-foreground">/10</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
