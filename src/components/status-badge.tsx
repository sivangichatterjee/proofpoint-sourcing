import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CompanyStatus } from "@/lib/types";

const statusStyles: Record<CompanyStatus, string> = {
  NEW: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900/30 dark:text-blue-300",
  REVIEWING:
    "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-900/30 dark:text-amber-300",
  PRIORITY_FOLLOW_UP:
    "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-900/30 dark:text-emerald-300",
  PASS: "bg-gray-100 text-gray-500 border-transparent dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_LABELS: Record<CompanyStatus, string> = {
  NEW: "New",
  REVIEWING: "Reviewing",
  PRIORITY_FOLLOW_UP: "Priority Follow-Up",
  PASS: "Pass",
};

export function StatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <Badge className={cn(statusStyles[status])}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
