import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CompanyStatus } from "@/lib/types";

const statusStyles: Record<CompanyStatus, string> = {
  NEW: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900/30 dark:text-blue-300",
  REVIEWING:
    "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-900/30 dark:text-amber-300",
  PRIORITY:
    "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-900/30 dark:text-emerald-300",
  FOLLOW_UP:
    "bg-violet-100 text-violet-800 border-transparent dark:bg-violet-900/30 dark:text-violet-300",
  PASS: "bg-gray-100 text-gray-500 border-transparent dark:bg-gray-800 dark:text-gray-400",
};

export function StatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <Badge className={cn(statusStyles[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
}
