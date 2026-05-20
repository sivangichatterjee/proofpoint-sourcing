"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export type CompanyRow = {
  id: string;
  name: string;
  website: string | null;
  vertical: string | null;
  stage: string | null;
  status: string;
  thesisFit: string | null;
  createdAt: Date;
};

const STATUS_OPTIONS: Array<CompanyStatus | "ALL"> = [
  "ALL",
  "NEW",
  "REVIEWING",
  "PRIORITY",
  "FOLLOW_UP",
  "PASS",
];

function parseScore(thesisFit: string | null): number | null {
  if (!thesisFit) return null;
  try {
    const parsed = JSON.parse(thesisFit);
    return typeof parsed.score === "number" ? parsed.score : null;
  } catch {
    return null;
  }
}

export function QueueTable({ companies }: { companies: CompanyRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | "ALL">("ALL");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return companies
      .filter((c) => {
        const matchesSearch =
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.website ?? "").toLowerCase().includes(q) ||
          (c.vertical ?? "").toLowerCase().includes(q);
        const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const sa = parseScore(a.thesisFit) ?? -1;
        const sb = parseScore(b.thesisFit) ?? -1;
        return sortDir === "desc" ? sb - sa : sa - sb;
      });
  }, [companies, search, statusFilter, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by name, website, or vertical…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as CompanyStatus | "ALL")}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "All statuses" : s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortDir}
          onValueChange={(v) => setSortDir(v as "asc" | "desc")}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Score: High → Low</SelectItem>
            <SelectItem value="asc">Score: Low → High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Vertical</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-muted-foreground"
              >
                No companies match your filters.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((company) => {
              const score = parseScore(company.thesisFit);
              return (
                <TableRow key={company.id}>
                  <TableCell>
                    <Link
                      href={`/companies/${company.id}`}
                      className="font-medium hover:underline"
                    >
                      {company.name}
                    </Link>
                    {company.website && (
                      <div className="text-xs text-muted-foreground">
                        {company.website}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{company.vertical ?? "—"}</TableCell>
                  <TableCell>{company.stage ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={company.status as CompanyStatus} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {score !== null ? `${score}/10` : "—"}
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
