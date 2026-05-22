"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Loader2Icon, PencilIcon, Plus, RefreshCwIcon, Scale, SparklesIcon, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NEXT_STEP_OPTIONS, normalizeSignals } from "@/lib/types";
import type { CompanyStatus, CompanyProfile, ThesisFit, SignalItem } from "@/lib/types";

const ALL_STATUSES: CompanyStatus[] = [
  "NEW",
  "REVIEWING",
  "PRIORITY_FOLLOW_UP",
  "PASS",
];

const STATUS_DOT_COLOR: Record<string, string> = {
  NEW: "bg-blue-500",
  REVIEWING: "bg-amber-500",
  PRIORITY_FOLLOW_UP: "bg-emerald-500",
  PASS: "bg-zinc-400",
};

function displayStatus(status: string): string {
  const labels: Record<string, string> = {
    NEW: "NEW",
    REVIEWING: "REVIEWING",
    PRIORITY_FOLLOW_UP: "PRIORITY FOLLOW-UP",
    PASS: "PASS",
  };
  return labels[status] ?? status;
}

const DETAIL_BADGE_STYLES: Record<string, string> = {
  PRIORITY_FOLLOW_UP: "bg-emerald-50 text-emerald-900 border border-emerald-200",
  REVIEWING: "bg-amber-50 text-amber-900 border border-amber-200",
  NEW: "bg-blue-50 text-blue-900 border border-blue-200",
  PASS: "bg-zinc-100 text-zinc-700 border border-zinc-200",
};

type SerializedNote = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

type EvalResult = {
  model: string;
  modelLabel: string;
  score: number;
  recommendation: string;
  rationale: string;
  fallback: boolean;
};

export type CompanyDetailProps = {
  id: string;
  name: string;
  website: string | null;
  sourceUrl: string | null;
  oneLiner: string | null;
  vertical: string | null;
  stage: string | null;
  status: string;
  nextStep: string | null;
  profile: CompanyProfile | null;
  thesisFit: ThesisFit | null;
  humanEdits: Record<string, boolean> | null;
  notes: SerializedNote[];
};

function getDisplayHost(company: {
  sourceUrl: string | null;
  website: string | null;
}): { host: string; url: string } | null {
  const url = company.sourceUrl ?? company.website;
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return { host, url };
  } catch {
    return null;
  }
}

// ── Shared field label ─────────────────────────────────────────────────────────

function FieldLabel({
  label,
  isEdited,
  children,
}: {
  label: string;
  isEdited: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium font-sans uppercase tracking-[0.08em] text-muted-foreground/80">
        {label}
      </span>
      {isEdited && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-1 inline-flex items-center text-[10px] uppercase tracking-wider text-[var(--proofpoint-orange)] border border-[var(--proofpoint-orange)]/30 px-1.5 py-0.5 rounded cursor-help">
                Edited
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-center">
              <p className="text-xs leading-relaxed">
                This field was edited by a reviewer. When you regenerate, you can choose to incorporate these edits as context for the AI.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {children}
    </div>
  );
}

// ── Editable single-value field ───────────────────────────────────────────────

function EditableTextField({
  label,
  value,
  field,
  section,
  companyId,
  isEdited,
  onRefresh,
}: {
  label: string;
  value: string;
  field: string;
  section: "profile" | "thesisFit";
  companyId: string;
  isEdited: boolean;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value: draft, section }),
      });
      if (res.ok) {
        toast.success("Saved");
        setEditing(false);
        onRefresh();
      } else {
        toast.error("Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="group/field space-y-2">
      <FieldLabel label={label} isEdited={isEdited}>
        {!editing && (
          <button
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            className="opacity-0 group-hover/field:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            aria-label={`Edit ${label}`}
          >
            <PencilIcon className="size-3" />
          </button>
        )}
      </FieldLabel>
      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Editing — content below will replace the current value</span>
            <button
              onClick={() => setDraft("")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Clear
            </button>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="xs"
              onClick={save}
              disabled={saving}
              className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white shadow-none border-0 transition-all duration-200 hover:scale-[1.02]"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xl leading-relaxed text-foreground">{value}</p>
      )}
    </div>
  );
}

// ── Editable array field ──────────────────────────────────────────────────────

function EditableArrayField({
  label,
  values,
  field,
  section,
  companyId,
  isEdited,
  onRefresh,
  renderDisplay,
}: {
  label: string;
  values: string[];
  field: string;
  section: "profile" | "thesisFit";
  companyId: string;
  isEdited: boolean;
  onRefresh: () => void;
  renderDisplay: (values: string[]) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values.join("\n"));
  const [saving, setSaving] = useState(false);

  async function save() {
    const newValues = draft
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value: newValues, section }),
      });
      if (res.ok) {
        toast.success("Saved");
        setEditing(false);
        onRefresh();
      } else {
        toast.error("Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="group/field space-y-2">
      <FieldLabel label={label} isEdited={isEdited}>
        {!editing && (
          <button
            onClick={() => {
              setDraft(values.join("\n"));
              setEditing(true);
            }}
            className="opacity-0 group-hover/field:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            aria-label={`Edit ${label}`}
          >
            <PencilIcon className="size-3" />
          </button>
        )}
      </FieldLabel>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="One item per line"
            className="text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="xs"
              onClick={save}
              disabled={saving}
              className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white shadow-none border-0 transition-all duration-200 hover:scale-[1.02]"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        renderDisplay(values)
      )}
    </div>
  );
}

// ── Signals field with provenance badges ─────────────────────────────────────

function SignalsField({
  signals,
  companyId,
  isEdited,
  onRefresh,
}: {
  signals: SignalItem[];
  companyId: string;
  isEdited: boolean;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editSignals, setEditSignals] = useState<SignalItem[]>([]);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setEditSignals([...signals]);
    setEditing(true);
  }

  function updateSignal(index: number, text: string) {
    setEditSignals((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, text, source: s.source === "ai" ? "analyst" : s.source }
          : s
      )
    );
  }

  function removeSignal(index: number) {
    setEditSignals((prev) => prev.filter((_, i) => i !== index));
  }

  function addSignal() {
    setEditSignals((prev) => [
      ...prev,
      { text: "", source: "analyst" as const, addedAt: new Date().toISOString() },
    ]);
  }

  function cancelEdit() {
    setEditing(false);
    setEditSignals([]);
  }

  async function saveSignals() {
    const finalSignals: SignalItem[] = editSignals
      .filter((s) => s.text.trim())
      .map((s) => {
        const originalMatch = signals.find(
          (orig) => orig.source === "ai" && orig.text === s.text
        );
        if (originalMatch) return originalMatch;
        return { text: s.text.trim(), source: "analyst" as const, addedAt: s.addedAt ?? new Date().toISOString() };
      });

    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "signalsExtracted", value: finalSignals, section: "profile" }),
      });
      if (res.ok) {
        setEditing(false);
        setEditSignals([]);
        onRefresh();
      } else {
        toast.error("Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="group/field space-y-2">
      <FieldLabel label="Signals Extracted" isEdited={isEdited}>
        {!editing && (
          <button
            onClick={startEdit}
            className="opacity-0 group-hover/field:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            aria-label="Edit Signals Extracted"
          >
            <PencilIcon className="size-3" />
          </button>
        )}
      </FieldLabel>
      {editing ? (
        <div className="space-y-2">
          {editSignals.map((signal, i) => (
            <div key={i} className="flex items-start gap-3 group/row">
              <span className={cn(
                "mt-3 size-2 rounded-full shrink-0",
                signal.source === "analyst" ? "bg-blue-500" : "bg-[var(--proofpoint-orange)]"
              )} />
              <input
                type="text"
                value={signal.text}
                onChange={(e) => updateSignal(i, e.target.value)}
                className="flex-1 text-base bg-transparent border-0 border-b border-border outline-none py-1 focus:border-[var(--proofpoint-orange)] transition-colors placeholder:text-muted-foreground/50"
                placeholder="Enter signal…"
                autoFocus={i === 0 && editSignals.length > 0}
              />
              <button
                onClick={() => removeSignal(i)}
                className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mt-2"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/40">
            <span className="size-2 rounded-full bg-blue-500 shrink-0" />
            <button
              onClick={addSignal}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Plus className="size-3.5" />
              Add signal
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={saveSignals}
              disabled={saving}
              className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white shadow-none border-0"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="ghost"
              onClick={cancelEdit}
              disabled={saving}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ul className="space-y-2.5">
            {signals.map((signal, i) => (
              <li key={i} className="flex items-start gap-3 text-base leading-relaxed text-foreground group">
                <span className={cn(
                  "mt-2 size-2 rounded-full shrink-0",
                  signal.source === "analyst" ? "bg-blue-500" : "bg-[var(--proofpoint-orange)]"
                )} />
                <span className="flex-1">{signal.text}</span>
                {signal.source === "ai" && signal.sourceUrl && (
                  <a
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    title="Verify source"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
          {signals.some((s) => s.source === "analyst") && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-[var(--proofpoint-orange)]" />
                AI-extracted
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-blue-500" />
                Analyst-added
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── AI card header ────────────────────────────────────────────────────────────

function AiCardHeader({
  title,
  meta,
  onRegenerate,
  regenerating,
  regenerateDisabled,
  regenerateDisabledTooltip,
}: {
  title: string;
  meta?: { model: string; generatedAt: string };
  onRegenerate: () => void;
  regenerating: boolean;
  regenerateDisabled: boolean;
  regenerateDisabledTooltip?: string;
}) {
  const button = (
    <Button
      variant="outline"
      size="default"
      onClick={onRegenerate}
      disabled={regenerating || regenerateDisabled}
      className={cn("gap-2 text-base px-4 py-2", regenerateDisabled ? "pointer-events-none" : undefined)}
      tabIndex={regenerateDisabled ? -1 : 0}
    >
      {regenerating ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <RefreshCwIcon className="size-4" />
      )}
      {regenerating ? "Generating…" : "Regenerate"}
    </Button>
  );

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium tracking-wide bg-[var(--proofpoint-orange)]/8 text-[var(--proofpoint-orange)] border border-[var(--proofpoint-orange)]/20">
            <SparklesIcon className="size-3" />
            AI-GENERATED
          </span>
          {meta && (
            <span className="text-[11px] text-muted-foreground font-sans">
              {new Date(meta.generatedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          )}
        </div>
        <h2 className="text-xl font-semibold font-sans">{title}</h2>
      </div>
      {regenerateDisabled && regenerateDisabledTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0 inline-flex">{button}</span>
          </TooltipTrigger>
          <TooltipContent>{regenerateDisabledTooltip}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="shrink-0 inline-flex">{button}</span>
      )}
    </div>
  );
}

// ── Mismatch detection ────────────────────────────────────────────────────────

const STATUS_TIER: Record<string, number> = {
  PRIORITY_FOLLOW_UP: 2,
  REVIEWING: 1,
  NEW: 0,
  PASS: -1,
};

const RECOMMENDATION_TO_STATUS: Record<string, string> = {
  PRIORITY_FOLLOW_UP: "PRIORITY_FOLLOW_UP",
  REVIEWING: "REVIEWING",
  PASS: "PASS",
};

function hasMeaningfulMismatch(currentStatus: string, newRecommendation: string): boolean {
  const currentTier = STATUS_TIER[currentStatus] ?? 0;
  const recommendedTier = STATUS_TIER[newRecommendation] ?? 0;
  return Math.abs(currentTier - recommendedTier) >= 2;
}

// ── Main component ────────────────────────────────────────────────────────────

export function CompanyDetail({
  id,
  name,
  website,
  sourceUrl,
  oneLiner,
  vertical,
  stage,
  status,
  nextStep,
  profile,
  thesisFit,
  humanEdits,
  notes,
}: CompanyDetailProps) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const [selectedNextStep, setSelectedNextStep] = useState(nextStep ?? "");
  const [customNextStep, setCustomNextStep] = useState("");
  const [nextStepSaved, setNextStepSaved] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [isRegeneratingProfile, setIsRegeneratingProfile] = useState(false);
  const [showProfileRegenerateDialog, setShowProfileRegenerateDialog] = useState(false);
  const [isRegeneratingThesisFit, setIsRegeneratingThesisFit] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [mismatchSuggestion, setMismatchSuggestion] = useState<{ recommendation: string; currentStatus: string; suggestedStatus: string } | null>(null);
  const [statusUpdateConfirmed, setStatusUpdateConfirmed] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showEval, setShowEval] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalResults, setEvalResults] = useState<EvalResult[] | null>(null);
  const [preferredModel, setPreferredModel] = useState<string | null>(null);
  const [preferenceSaved, setPreferenceSaved] = useState(false);

  useEffect(() => {
    if (!showEval || evalResults) return;
    runEval();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEval]);

  const isCustomNextStep = selectedNextStep === "Custom…";

  const TRACKED_PROFILE_FIELDS: Record<string, string> = {
    description: "Description",
    productSummary: "Product Summary",
    targetCustomer: "Target Customer",
  };

  const editedProfileFields: Record<string, string> = {};
  Object.keys(TRACKED_PROFILE_FIELDS).forEach((field) => {
    if (humanEdits?.[`profile.${field}`]) {
      const value = (profile as Record<string, unknown> | null)?.[field];
      if (value && typeof value === "string") {
        editedProfileFields[field] = value;
      }
    }
  });
  const hasProfileEdits = Object.keys(editedProfileFields).length > 0;

  function handleRegenerateProfile() {
    if (hasProfileEdits) {
      setShowProfileRegenerateDialog(true);
    } else {
      runProfileRegenerate(undefined);
    }
  }

  async function runProfileRegenerate(edits: Record<string, string> | undefined) {
    setShowProfileRegenerateDialog(false);
    setIsRegeneratingProfile(true);
    try {
      // Write each edited field back via PATCH so humanEdits flags are confirmed in DB
      if (edits && Object.keys(edits).length > 0) {
        await Promise.all(
          Object.entries(edits).map(([field, value]) =>
            fetch(`/api/companies/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ section: "profile", field, value }),
            })
          )
        );
      }
      const res = await fetch(`/api/companies/${id}/profile`, { method: "POST" });
      if (res.ok) {
        toast.success(edits ? "Profile regenerated incorporating your edits" : "Profile regenerated fresh");
        router.refresh();
      } else {
        toast.error("Regeneration failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsRegeneratingProfile(false);
    }
  }

  // humanEdits stores boolean flags like {"thesisFit.rationale": true}
  const hasThesisEdit = !!(
    humanEdits?.["thesisFit.rationale"] ||
    (humanEdits as Record<string, unknown> | null)?.thesisFit
  );
  // Actual edited text lives in thesisFit.rationale, not in humanEdits
  const humanEditedRationale = hasThesisEdit ? (thesisFit?.rationale ?? undefined) : undefined;

  function handleRegenerateThesisFit() {
    if (hasThesisEdit) {
      setShowRegenerateDialog(true);
    } else {
      runRegenerate(undefined);
    }
  }

  async function runRegenerate(context: string | undefined) {
    setShowRegenerateDialog(false);
    setIsRegeneratingThesisFit(true);
    try {
      const res = await fetch(`/api/companies/${id}/thesis-fit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanEditedRationale: context ?? null }),
      });
      if (res.ok) {
        const data = await res.json();
        const newRecommendation: string | null = data.thesisFit?.recommendation ?? null;
        const isFallback = data.thesisFit?._meta?.fallback === true;

        if (newRecommendation && !isFallback && hasMeaningfulMismatch(status, newRecommendation)) {
          const suggestedStatus = RECOMMENDATION_TO_STATUS[newRecommendation];
          setMismatchSuggestion({
            recommendation: newRecommendation,
            currentStatus: status,
            suggestedStatus,
          });
        } else {
          toast.success(context ? "Thesis regenerated incorporating your notes" : "Thesis regenerated");
        }

        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Regeneration failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsRegeneratingThesisFit(false);
    }
  }

  async function saveNextStep(value: string) {
    const finalValue = value === "Custom…" ? customNextStep : value;
    if (!finalValue) return;
    const res = await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "nextStep", value: finalValue, section: "company" }),
    });
    if (res.ok) {
      setNextStepSaved(true);
      setTimeout(() => setNextStepSaved(false), 2000);
      router.refresh();
    } else {
      toast.error("Failed to save next step");
    }
  }

  async function handleNextStepChange(value: string) {
    setSelectedNextStep(value);
    if (value === "Custom…") return;
    await saveNextStep(value);
  }

  async function handleStatusChange(newStatus: string) {
    await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "company",
        field: "status",
        value: newStatus,
      }),
    });
    router.refresh();
  }

  async function runEval() {
    setEvalLoading(true);
    try {
      const res = await fetch(`/api/companies/${id}/eval`, { method: "POST" });
      const data = await res.json();
      setEvalResults(data.results);
    } catch {
      toast.error("Eval failed");
    } finally {
      setEvalLoading(false);
    }
  }

  async function savePreference(model: string, result: EvalResult) {
    setPreferredModel(model);

    if (model !== "current") {
      const newThesisFit = {
        score: result.score,
        recommendation: result.recommendation,
        rationale: result.rationale,
        _meta: {
          model: result.model,
          generatedAt: new Date().toISOString(),
          promptVersion: "eval-selected",
          fallback: false,
        },
      };
      await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thesisFit: JSON.stringify(newThesisFit) }),
      });
      toast.success(`${result.modelLabel}'s analysis adopted as active thesis fit`);
      setShowEval(false);
      setEvalResults(null);
      setPreferredModel(null);
      router.refresh();
    }

    await fetch(`/api/companies/${id}/eval`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferredModel: model,
        results: evalResults,
        profileJson: JSON.stringify(profile ?? {}),
      }),
    });

    if (model === "current") {
      setPreferenceSaved(true);
      setTimeout(() => setPreferenceSaved(false), 2000);
    }
  }

  async function handleAddNote() {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    setNoteSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (res.ok) {
        toast.success("Note added");
        setNoteText("");
        router.refresh();
      } else {
        toast.error("Failed to add note");
      }
    } finally {
      setNoteSubmitting(false);
    }
  }

  const sourceInfo = getDisplayHost({ sourceUrl, website });

  return (
    <div className="space-y-8">
      {/* ── Back link ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-background/95 backdrop-blur-sm border-b border-border/40 mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          Back to queue
        </Link>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-border pb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-serif text-5xl font-medium tracking-tight text-foreground leading-tight">
              {name}
            </h1>
            {oneLiner && (
              <p className="mt-2 font-serif italic text-lg text-muted-foreground">
                {oneLiner}
              </p>
            )}
          </div>
          {/* ── Workflow column ── */}
          <div className="flex flex-col gap-5 min-w-[260px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium font-sans uppercase tracking-[0.08em] text-muted-foreground">
                Status
              </label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full shrink-0", STATUS_DOT_COLOR[status] ?? "bg-zinc-400")} />
                    <span className="text-sm">{displayStatus(status)}</span>
                  </div>
                </SelectTrigger>
                <SelectContent position="popper" align="end" sideOffset={4} className="min-w-[180px]">
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <div className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full shrink-0", STATUS_DOT_COLOR[s])} />
                        {displayStatus(s)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-medium font-sans uppercase tracking-[0.08em] text-muted-foreground">
                Next Step
              </label>
              <Select value={selectedNextStep} onValueChange={handleNextStepChange}>
                <SelectTrigger className="w-full text-sm border-0 border-b border-border rounded-none bg-transparent px-0 focus:ring-0 focus:border-foreground transition-colors">
                  <SelectValue placeholder="Choose a next step…" />
                </SelectTrigger>
                <SelectContent position="popper" align="end" sideOffset={4}>
                  {NEXT_STEP_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="text-sm">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCustomNextStep && (
                <input
                  type="text"
                  value={customNextStep}
                  onChange={(e) => setCustomNextStep(e.target.value)}
                  onBlur={() => saveNextStep("Custom…")}
                  placeholder="Describe the next step…"
                  className="text-sm border-0 border-b border-border bg-transparent px-0 py-1 outline-none placeholder:text-muted-foreground/60 focus:border-foreground transition-colors mt-1"
                  autoFocus
                />
              )}
              {nextStepSaved && (
                <span className="text-xs text-emerald-600 transition-opacity">
                  Saved ✓
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Meta row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-8 pb-6 border-b border-border">
        <div>
          <p className="text-xs font-medium font-sans uppercase tracking-[0.08em] text-muted-foreground/80 mb-1.5">
            Source
          </p>
          {sourceInfo ? (
            <a
              href={sourceInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg text-foreground hover:underline line-clamp-1"
            >
              {sourceInfo.host}
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
        <div>
          <p className="text-xs font-medium font-sans uppercase tracking-[0.08em] text-muted-foreground/80 mb-1.5">
            Vertical
          </p>
          <p className="text-lg text-foreground">{vertical ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium font-sans uppercase tracking-[0.08em] text-muted-foreground/80 mb-1.5">
            Stage
          </p>
          <p className="text-lg text-foreground">{stage ?? "—"}</p>
        </div>
      </div>

      {/* ── Profile card ───────────────────────────────────────────────── */}
      <section className="rounded-xl bg-muted/30 ring-1 ring-foreground/10 p-5">
        <div className="mb-6">
          <AiCardHeader
            title="Company Profile"
            meta={profile?._meta}
            onRegenerate={handleRegenerateProfile}
            regenerating={isRegeneratingProfile}
            regenerateDisabled={false}
          />
        </div>
        {profile ? (
          <div className="divide-y divide-border/40">
            <div className="pb-6">
              <EditableTextField
                label="Description"
                value={profile.description}
                field="description"
                section="profile"
                companyId={id}
                isEdited={humanEdits?.["profile.description"] ?? false}
                onRefresh={refresh}
              />
            </div>
            <div className="py-6">
              <EditableTextField
                label="Product Summary"
                value={profile.productSummary}
                field="productSummary"
                section="profile"
                companyId={id}
                isEdited={humanEdits?.["profile.productSummary"] ?? false}
                onRefresh={refresh}
              />
            </div>
            <div className="py-6">
              <EditableTextField
                label="Target Customer"
                value={profile.targetCustomer}
                field="targetCustomer"
                section="profile"
                companyId={id}
                isEdited={humanEdits?.["profile.targetCustomer"] ?? false}
                onRefresh={refresh}
              />
            </div>
            <div className="py-6">
              <EditableArrayField
                label="Categories"
                values={profile.verticalTags}
                field="verticalTags"
                section="profile"
                companyId={id}
                isEdited={humanEdits?.["profile.verticalTags"] ?? false}
                onRefresh={refresh}
                renderDisplay={(vals) => (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {vals.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium tracking-wide bg-muted/60 text-foreground/80 border border-border"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              />
            </div>
            <div className="pt-6">
              <SignalsField
                signals={normalizeSignals(profile.signalsExtracted ?? [])}
                companyId={id}
                isEdited={humanEdits?.["profile.signalsExtracted"] ?? false}
                onRefresh={refresh}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No profile yet — run a scan to generate.
          </p>
        )}
      </section>

      {/* ── Thesis Fit card ────────────────────────────────────────────── */}
      <section className="rounded-xl bg-muted/30 ring-1 ring-foreground/10 p-5">
        <div className="mb-6">
          <AiCardHeader
            title="Thesis Fit"
            meta={thesisFit?._meta}
            onRegenerate={handleRegenerateThesisFit}
            regenerating={isRegeneratingThesisFit}
            regenerateDisabled={!profile}
            regenerateDisabledTooltip={!profile ? "Generate profile first" : undefined}
          />
          <div className="flex justify-end mt-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => setShowEval(true)}
              disabled={!profile}
              className="gap-2 text-base px-4 py-2"
            >
              <Scale className="size-4" />
              Compare models
            </Button>
          </div>
        </div>
        {thesisFit ? (
          <div className="space-y-6">
            <div className="flex items-end gap-12">
              <div>
                <p className="text-xs font-medium font-sans uppercase tracking-[0.08em] text-muted-foreground/80 mb-2">
                  Thesis Fit Score
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif text-6xl font-medium tabular-nums text-foreground">
                    {thesisFit.score}
                  </span>
                  <span className="text-lg text-muted-foreground">/10</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium font-sans uppercase tracking-[0.08em] text-muted-foreground/80 mb-2">
                  Recommendation
                </p>
                {(() => {
                  const recommendedStatus = RECOMMENDATION_TO_STATUS[thesisFit.recommendation] ?? null;
                  const showApplyButton =
                    recommendedStatus &&
                    recommendedStatus !== status &&
                    status === "NEW";
                  return (
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-3 py-1 rounded-md text-xs font-medium tracking-wide uppercase",
                          DETAIL_BADGE_STYLES[thesisFit.recommendation] ??
                            "bg-muted text-muted-foreground"
                        )}
                      >
                        {thesisFit.recommendation.replace("_", " ")}
                      </span>
                      {showApplyButton && !applied && (
                        <button
                          onClick={async () => {
                            await fetch(`/api/companies/${id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                section: "company",
                                field: "status",
                                value: recommendedStatus,
                              }),
                            });
                            setApplied(true);
                            setTimeout(() => setApplied(false), 2000);
                            router.refresh();
                          }}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded px-2 py-1 transition-colors"
                        >
                          Apply
                          <ArrowRight className="size-3" />
                        </button>
                      )}
                      {applied && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="size-3" />
                          Applied
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            {mismatchSuggestion && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    AI assessment suggests{" "}
                    <span className="font-semibold">{mismatchSuggestion.recommendation}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Your current status is{" "}
                    <span className="font-medium text-foreground">{mismatchSuggestion.currentStatus}</span>
                    . Would you like to update it?
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMismatchSuggestion(null)}
                    className="text-sm px-4 text-muted-foreground hover:text-foreground border-border hover:border-foreground/40 transition-colors"
                  >
                    Keep as {mismatchSuggestion.currentStatus}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await fetch(`/api/companies/${id}/status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: mismatchSuggestion.suggestedStatus }),
                      });
                      setMismatchSuggestion(null);
                      setStatusUpdateConfirmed(true);
                      setTimeout(() => setStatusUpdateConfirmed(false), 3000);
                      router.refresh();
                    }}
                    className="text-sm px-4 text-foreground border-foreground/30 hover:border-foreground hover:bg-muted/40 transition-colors"
                  >
                    Update to {mismatchSuggestion.suggestedStatus}
                  </Button>
                </div>
              </div>
            )}
            {statusUpdateConfirmed && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-foreground" />
                <span className="text-foreground">Status updated</span>
              </div>
            )}
            <EditableTextField
              label="Rationale"
              value={thesisFit.rationale}
              field="rationale"
              section="thesisFit"
              companyId={id}
              isEdited={humanEdits?.["thesisFit.rationale"] ?? false}
              onRefresh={refresh}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No thesis fit yet — run a scan to generate.
          </p>
        )}
      </section>

      {/* ── Model comparison panel ─────────────────────────────────────── */}
      {showEval && (
        <div className="rounded-lg border border-border bg-background p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Scale className="size-5 text-[var(--proofpoint-orange)]" />
              <h3 className="font-semibold text-xl">Thesis Fit — Model Comparison</h3>
            </div>
            <Button
              variant="ghost"
              onClick={() => { setShowEval(false); setEvalResults(null); setPreferredModel(null); }}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Close
            </Button>
          </div>

          {evalLoading && (
            <div className="flex items-center gap-3 text-muted-foreground py-8 justify-center">
              <Loader2Icon className="size-5 animate-spin" />
              <span className="text-base">Running models in parallel…</span>
            </div>
          )}

          {evalResults && thesisFit && (() => {
            const currentPanel = {
              model: "current",
              modelLabel: "Current",
              score: thesisFit.score,
              recommendation: thesisFit.recommendation,
              rationale: thesisFit.rationale,
              fallback: false,
              isCurrent: true,
            };
            const allPanels = [currentPanel, ...evalResults.map((r) => ({ ...r, isCurrent: false }))];
            return (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {allPanels.map((result) => (
                    <div
                      key={result.model}
                      className={cn(
                        "rounded-lg border p-5 flex flex-col gap-4 transition-all",
                        preferredModel === result.model
                          ? "border-[var(--proofpoint-orange)] bg-[var(--proofpoint-orange)]/5"
                          : "border-border hover:border-muted-foreground/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          {result.modelLabel}
                        </span>
                        <div className="flex items-center gap-2">
                          {result.isCurrent && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                              Active
                            </span>
                          )}
                          {result.fallback && (
                            <span className="text-xs text-destructive">Failed</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-end gap-3">
                        <span className="font-serif text-4xl font-medium tabular-nums">
                          {result.score}
                        </span>
                        <span className="text-sm text-muted-foreground mb-1">/10</span>
                        <span className={cn(
                          "ml-auto inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium tracking-wide uppercase border",
                          result.recommendation === "PRIORITY_FOLLOW_UP" && "bg-emerald-100 text-emerald-900 border-emerald-300",
                          result.recommendation === "REVIEWING" && "bg-amber-100 text-amber-900 border-amber-300",
                          result.recommendation === "NEW" && "bg-blue-100 text-blue-900 border-blue-300",
                          result.recommendation === "PASS" && "bg-zinc-200 text-zinc-800 border-zinc-300",
                        )}>
                          {result.recommendation}
                        </span>
                      </div>

                      <p className="text-base leading-relaxed text-foreground flex-1">
                        {result.rationale}
                      </p>

                      <Button
                        onClick={() => savePreference(result.model, result)}
                        variant={preferredModel === result.model ? "default" : "outline"}
                        className={cn(
                          "w-full mt-auto",
                          preferredModel === result.model
                            ? "bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white border-0"
                            : ""
                        )}
                      >
                        {preferredModel === result.model ? "✓ Active" : "This is more useful"}
                      </Button>
                    </div>
                  ))}
                </div>

                {preferenceSaved && (
                  <p className="text-sm text-emerald-600 text-center mt-4">
                    Preference saved ✓
                  </p>
                )}

                <p className="text-xs text-muted-foreground text-center mt-6">
                  Which analysis is most useful to you? Your preference is logged and can inform future model selection decisions.
                </p>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Regenerate profile dialog ──────────────────────────────────── */}
      <Dialog open={showProfileRegenerateDialog} onOpenChange={setShowProfileRegenerateDialog}>
        <DialogContent showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium">
              You have edited this profile
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              How should the AI regenerate the company profile?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2">
            <button
              onClick={() => runProfileRegenerate(undefined)}
              className="group flex items-start gap-4 rounded-lg border border-border p-4 text-left hover:border-[var(--proofpoint-orange)]/60 hover:bg-[var(--proofpoint-orange)]/8 transition-all"
            >
              <div className="mt-0.5 rounded-md bg-muted p-2 shrink-0 group-hover:bg-[var(--proofpoint-orange)]/15 transition-colors">
                <RefreshCwIcon className="size-4 text-muted-foreground group-hover:text-[var(--proofpoint-orange)] transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Fresh analysis</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Ignore my edits — regenerate from source text only
                </p>
              </div>
            </button>
            <button
              onClick={() => runProfileRegenerate(editedProfileFields)}
              className="group flex items-start gap-4 rounded-lg border border-border p-4 text-left hover:border-[var(--proofpoint-orange)]/60 hover:bg-[var(--proofpoint-orange)]/8 transition-all"
            >
              <div className="mt-0.5 rounded-md bg-muted p-2 shrink-0 group-hover:bg-[var(--proofpoint-orange)]/15 transition-colors">
                <SparklesIcon className="size-4 text-muted-foreground group-hover:text-[var(--proofpoint-orange)] transition-colors" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Incorporate my notes</p>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-[var(--proofpoint-orange)] opacity-0 group-hover:opacity-100 transition-all" />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Pass my edited fields to the AI as reviewer corrections
                </p>
              </div>
            </button>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              onClick={() => setShowProfileRegenerateDialog(false)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Regenerate thesis dialog ───────────────────────────────────── */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium">
              You have edited this analysis
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              How should the AI regenerate the thesis fit?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2">
            <button
              onClick={() => runRegenerate(undefined)}
              className="group flex items-start gap-4 rounded-lg border border-border p-4 text-left hover:border-[var(--proofpoint-orange)]/60 hover:bg-[var(--proofpoint-orange)]/8 transition-all"
            >
              <div className="mt-0.5 rounded-md bg-muted p-2 shrink-0 group-hover:bg-[var(--proofpoint-orange)]/15 transition-colors">
                <RefreshCwIcon className="size-4 text-muted-foreground group-hover:text-[var(--proofpoint-orange)] transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Fresh analysis</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Ignore my edits — regenerate from the company profile only
                </p>
              </div>
            </button>
            <button
              onClick={() => runRegenerate(humanEditedRationale)}
              className="group flex items-start gap-4 rounded-lg border border-border p-4 text-left hover:border-[var(--proofpoint-orange)]/60 hover:bg-[var(--proofpoint-orange)]/8 transition-all"
            >
              <div className="mt-0.5 rounded-md bg-muted p-2 shrink-0 group-hover:bg-[var(--proofpoint-orange)]/15 transition-colors">
                <SparklesIcon className="size-4 text-muted-foreground group-hover:text-[var(--proofpoint-orange)] transition-colors" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Incorporate my notes</p>
                  <ArrowRight className="size-4 text-[var(--proofpoint-orange)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Pass my edits to the AI as reviewer context
                </p>
              </div>
            </button>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              onClick={() => setShowRegenerateDialog(false)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reviewer Notes ──────────────────────────────────────────────── */}
      <section className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold font-sans">Reviewer Notes</h2>
            <span className="text-xs text-muted-foreground font-sans">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
          </div>

          {notes.length > 0 ? (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="pl-4 border-l-2 border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-medium font-sans text-foreground">
                      {note.author || "Reviewer"}
                    </span>
                    <span className="text-xs text-muted-foreground font-sans">
                      · {new Date(note.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xl leading-relaxed text-foreground">
                    {note.body}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}

          <div className="space-y-2 pt-2 border-t border-border">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              className="text-base"
              disabled={noteSubmitting}
            />
            <Button
              onClick={handleAddNote}
              disabled={noteSubmitting || !noteText.trim()}
              className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white shadow-none border-0 text-base px-5 py-2.5 disabled:opacity-50"
            >
              {noteSubmitting ? "Adding…" : "Add note"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
