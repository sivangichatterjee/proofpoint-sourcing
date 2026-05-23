"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, GitCompareArrows, Loader2Icon, PencilIcon, Plus, RefreshCwIcon, SparklesIcon, X } from "lucide-react";
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

const MODEL_LABELS: Record<string, string> = {
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": "Llama 3.3 70B",
  "deepseek-ai/DeepSeek-V4-Pro": "DeepSeek V4 Pro",
  "openai/gpt-oss-20b": "GPT-OSS 20B",
  "gpt-4o-mini": "GPT-4o Mini",
};

function displayModel(model: string | null | undefined): string {
  if (!model) return "current model";
  return MODEL_LABELS[model] ?? model;
}

type SerializedNote = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

type EvalResult = {
  model: string;
  modelLabel: string;
  score: number | null;
  recommendation: string | null;
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
  const signalInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pendingFocusIndex = useRef<number | null>(null);

  useEffect(() => {
    if (pendingFocusIndex.current === null) return;
    signalInputRefs.current[pendingFocusIndex.current]?.focus();
    pendingFocusIndex.current = null;
  }, [editSignals.length]);

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

  function updateSignalSourceUrl(index: number, sourceUrl: string) {
    setEditSignals((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              sourceUrl: sourceUrl.trim() || undefined,
              source: s.source === "ai" ? "analyst" : s.source,
            }
          : s
      )
    );
  }

  function removeSignal(index: number) {
    setEditSignals((prev) => prev.filter((_, i) => i !== index));
  }

  function addSignal() {
    pendingFocusIndex.current = editSignals.length;
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
        return {
          text: s.text.trim(),
          source: "analyst" as const,
          addedAt: s.addedAt ?? new Date().toISOString(),
          sourceUrl: s.sourceUrl?.trim() || undefined,
        };
      });

    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "signalsExtracted", value: finalSignals, section: "profile" }),
      });
      if (res.ok) {
        toast.success("Signals saved");
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
          {editSignals.length === 0 && (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              No signals yet.
            </div>
          )}
          {editSignals.map((signal, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={cn(
                "mt-3 size-2 rounded-full shrink-0",
                signal.source === "analyst" ? "bg-blue-500" : "bg-[var(--proofpoint-orange)]"
              )} />
              <div className="flex-1 space-y-1.5">
                <input
                  ref={(node) => {
                    signalInputRefs.current[i] = node;
                  }}
                  type="text"
                  value={signal.text}
                  onChange={(e) => updateSignal(i, e.target.value)}
                  className="w-full text-base bg-transparent border-0 border-b border-border outline-none py-1 focus:border-[var(--proofpoint-orange)] transition-colors placeholder:text-muted-foreground/50"
                  placeholder="Enter signal..."
                  autoFocus={i === 0 && editSignals.length > 0}
                />
                {signal.source === "analyst" && (
                  <input
                    type="url"
                    value={signal.sourceUrl ?? ""}
                    onChange={(e) => updateSignalSourceUrl(i, e.target.value)}
                    className="w-full text-xs bg-transparent border-0 border-b border-border/60 outline-none py-1 text-muted-foreground focus:border-[var(--proofpoint-orange)] transition-colors placeholder:text-muted-foreground/50"
                    placeholder="Optional source URL"
                  />
                )}
              </div>
              <button
                onClick={() => removeSignal(i)}
                className="text-muted-foreground hover:text-destructive mt-2 transition-colors"
                aria-label="Remove signal"
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
                <span className="min-w-0 flex-1">
                  <span>{signal.text}</span>
                  {signal.sourceUrl && (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={signal.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1.5 inline-flex translate-y-0.5 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Verify source</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </span>
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
  secondaryAction,
  onRegenerate,
  regenerating,
  regenerateDisabled,
  regenerateDisabledTooltip,
}: {
  title: string;
  meta?: { model: string; generatedAt: string; analystGuidance?: string };
  secondaryAction?: React.ReactNode;
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
      <div className="shrink-0 flex items-center gap-2">
        {secondaryAction}
        {regenerateDisabled && regenerateDisabledTooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{button}</span>
            </TooltipTrigger>
            <TooltipContent>{regenerateDisabledTooltip}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="inline-flex">{button}</span>
        )}
      </div>
    </div>
  );
}

const RECOMMENDATION_TO_STATUS: Record<string, string> = {
  PRIORITY_FOLLOW_UP: "PRIORITY_FOLLOW_UP",
  REVIEWING: "REVIEWING",
  PASS: "PASS",
};

const DEFAULT_NEXT_STEP_BY_STATUS: Record<string, string> = {
  PRIORITY_FOLLOW_UP: "Reach out to founder",
  REVIEWING: "Request pitch deck",
  PASS: "Pass — send decline note",
};

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
  const [profileGuidance, setProfileGuidance] = useState("");
  const [includeProfileEdits, setIncludeProfileEdits] = useState(false);
  const [isRegeneratingThesisFit, setIsRegeneratingThesisFit] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [thesisGuidance, setThesisGuidance] = useState("");
  const [includeThesisEdit, setIncludeThesisEdit] = useState(false);
  const [statusUpdateConfirmed, setStatusUpdateConfirmed] = useState(false);
  const [decisionStatus, setDecisionStatus] = useState(status);
  const [decisionNextStep, setDecisionNextStep] = useState(nextStep ?? "");
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionDismissed, setDecisionDismissed] = useState(false);
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
  const aiRecommendedStatus = thesisFit
    ? RECOMMENDATION_TO_STATUS[thesisFit.recommendation] ?? null
    : null;
  const aiSuggestedNextStep = aiRecommendedStatus
    ? nextStep ||
      DEFAULT_NEXT_STEP_BY_STATUS[aiRecommendedStatus] ||
      "Add to watch list"
    : "";

  useEffect(() => {
    if (status !== "NEW" || !aiRecommendedStatus) return;
    setDecisionStatus(aiRecommendedStatus);
    setDecisionNextStep(aiSuggestedNextStep);
    setDecisionDismissed(false);
  }, [status, aiRecommendedStatus, aiSuggestedNextStep]);

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
    setIncludeProfileEdits(hasProfileEdits);
    setShowProfileRegenerateDialog(true);
  }

  async function runProfileRegenerate() {
    setShowProfileRegenerateDialog(false);
    setIsRegeneratingProfile(true);
    const guidance = profileGuidance.trim();
    const edits = includeProfileEdits ? editedProfileFields : undefined;
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
      const res = await fetch(`/api/companies/${id}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          humanEdits: edits,
          analystGuidance: guidance || undefined,
        }),
      });
      if (res.ok) {
        toast.success(
          guidance
            ? "Profile regenerated with your guidance"
            : edits
              ? "Profile regenerated incorporating your edits"
              : "Profile regenerated"
        );
        setProfileGuidance("");
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
    setIncludeThesisEdit(hasThesisEdit);
    setShowRegenerateDialog(true);
  }

  async function runRegenerate() {
    setShowRegenerateDialog(false);
    setIsRegeneratingThesisFit(true);
    const guidance = thesisGuidance.trim();
    const context = includeThesisEdit ? humanEditedRationale : undefined;
    try {
      const res = await fetch(`/api/companies/${id}/thesis-fit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          humanEditedRationale: context ?? null,
          analystGuidance: guidance || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const isFallback = data.thesisFit?._meta?.fallback === true;

        if (!isFallback) {
          toast.success(
            guidance
              ? "Thesis regenerated with your guidance"
              : context
                ? "Thesis regenerated incorporating your notes"
                : "Thesis regenerated"
          );
        }

        setThesisGuidance("");
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

  async function saveDecision(nextStatus: string, nextAction: string) {
    if (!nextStatus || !nextAction) return;
    setDecisionSaving(true);
    try {
      const [statusRes, nextStepRes] = await Promise.all([
        fetch(`/api/companies/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section: "company",
            field: "status",
            value: nextStatus,
          }),
        }),
        fetch(`/api/companies/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section: "company",
            field: "nextStep",
            value: nextAction,
          }),
        }),
      ]);

      if (!statusRes.ok || !nextStepRes.ok) {
        toast.error("Failed to save decision");
        return;
      }

      setSelectedNextStep(nextAction);
      setDecisionStatus(nextStatus);
      setDecisionNextStep(nextAction);
      setDecisionDismissed(true);
      setStatusUpdateConfirmed(true);
      setTimeout(() => setStatusUpdateConfirmed(false), 3000);
      toast.success("Decision saved");
      router.refresh();
    } catch {
      toast.error("Failed to save decision");
    } finally {
      setDecisionSaving(false);
    }
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
    if (result.fallback || result.score == null || result.recommendation == null) {
      toast.error("This analysis did not generate successfully");
      return;
    }

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
	        <div className="mb-5">
	          <AiCardHeader
	            title="Thesis Fit"
	            meta={thesisFit?._meta}
	            secondaryAction={
	              <Button
	                variant="outline"
	                size="default"
	                onClick={() => setShowEval(true)}
	                disabled={!profile}
	                className="gap-2 text-base px-4 py-2"
	              >
	                <GitCompareArrows className="size-4" />
	                Compare models
	              </Button>
	            }
	            onRegenerate={handleRegenerateThesisFit}
	            regenerating={isRegeneratingThesisFit}
	            regenerateDisabled={!profile}
	            regenerateDisabledTooltip={!profile ? "Generate profile first" : undefined}
	          />
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
	                <span
	                  className={cn(
	                    "inline-flex items-center px-3 py-1 rounded-md text-xs font-medium tracking-wide uppercase",
	                    DETAIL_BADGE_STYLES[thesisFit.recommendation] ??
	                      "bg-muted text-muted-foreground"
	                  )}
	                >
	                  {thesisFit.recommendation.replace("_", " ")}
	                </span>
	              </div>
	            </div>
	            {(() => {
	              const actionable =
	                aiRecommendedStatus &&
	                status === "NEW" &&
	                aiRecommendedStatus !== status &&
	                !decisionDismissed;

	              if (!actionable) return null;

	              return (
	                <div className="rounded-lg border border-[var(--proofpoint-orange)]/20 bg-[var(--proofpoint-orange)]/5 p-4">
	                  <div>
	                    <p className="text-sm font-semibold text-foreground">
	                      AI recommends {displayStatus(aiRecommendedStatus).toLowerCase()}
	                    </p>
	                    <p className="mt-1 text-sm text-muted-foreground">
	                      Review the draft decision, choose the right next step, then save it to the queue.
	                    </p>
	                  </div>
	                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--proofpoint-orange)]/20 pt-4 sm:grid-cols-2">
	                    <div className="space-y-1.5">
	                      <label className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
	                        Status
	                      </label>
	                      <Select
	                        value={decisionStatus}
	                        onValueChange={(value) => {
	                          setDecisionStatus(value);
	                          setDecisionNextStep(
	                            DEFAULT_NEXT_STEP_BY_STATUS[value] ||
	                              decisionNextStep ||
	                              "Add to watch list"
	                          );
	                        }}
	                      >
	                        <SelectTrigger className="w-full">
	                          <SelectValue />
	                        </SelectTrigger>
	                        <SelectContent>
	                          {ALL_STATUSES.filter((s) => s !== "NEW").map((s) => (
	                            <SelectItem key={s} value={s}>
	                              {displayStatus(s)}
	                            </SelectItem>
	                          ))}
	                        </SelectContent>
	                      </Select>
	                    </div>
	                    <div className="space-y-1.5">
	                      <label className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
	                        Next step
	                      </label>
	                      <Select
	                        value={decisionNextStep}
	                        onValueChange={setDecisionNextStep}
	                      >
	                        <SelectTrigger className="w-full">
	                          <SelectValue />
	                        </SelectTrigger>
	                        <SelectContent>
	                          {NEXT_STEP_OPTIONS.filter((option) => option !== "Custom…").map((option) => (
	                            <SelectItem key={option} value={option}>
	                              {option}
	                            </SelectItem>
	                          ))}
	                        </SelectContent>
	                      </Select>
	                    </div>
	                    <div className="flex items-center gap-2 sm:col-span-2">
	                      <Button
	                        size="sm"
	                        onClick={() => saveDecision(decisionStatus, decisionNextStep)}
	                        disabled={decisionSaving || !decisionStatus || !decisionNextStep}
	                        className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white border-0"
	                      >
	                        {decisionSaving ? "Saving..." : "Save decision"}
	                      </Button>
	                      <Button
	                        size="sm"
	                        variant="ghost"
	                        onClick={() => setDecisionDismissed(true)}
	                        disabled={decisionSaving}
	                        className="text-muted-foreground hover:text-foreground"
	                      >
	                        Dismiss
	                      </Button>
	                    </div>
	                  </div>
	                </div>
	              );
	            })()}
	            {statusUpdateConfirmed && (
	              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground">
	                <CheckCircle2 className="size-4 shrink-0 text-foreground" />
	                <span className="text-foreground">Decision saved</span>
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
          <div className="flex items-start justify-between gap-6 mb-6 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--proofpoint-orange)]/10 text-[var(--proofpoint-orange)]">
                <GitCompareArrows className="size-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xl">Compare thesis analyses</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Pick the analysis that is most useful for this company. Your choice replaces the current thesis fit.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => { setShowEval(false); setEvalResults(null); setPreferredModel(null); }}
              className="shrink-0 text-muted-foreground hover:text-foreground text-sm"
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
	              modelLabel: displayModel(thesisFit._meta?.model),
	              score: thesisFit.score,
	              recommendation: thesisFit.recommendation,
	              rationale: thesisFit.rationale,
              fallback: false,
              isCurrent: true,
            };
	            const allPanels = [currentPanel, ...evalResults.map((r) => ({ ...r, isCurrent: false }))];
            return (
              <>
                <div
                  className={cn(
                    "grid grid-cols-1 gap-4",
                    allPanels.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"
                  )}
                >
                  {allPanels.map((result, index) => {
                    const isPreferred = preferredModel === result.model;
                    const isInitiallyActive = preferredModel === null && result.isCurrent;
                    const isActive = isPreferred || isInitiallyActive;
                    const didFail = result.fallback || result.score == null || result.recommendation == null;
	                    const title = result.isCurrent
	                      ? "Current analysis"
	                      : "Alternative";
                    const generatedBy = result.modelLabel;

                    return (
                    <div
                      key={result.model}
                      className={cn(
                        "rounded-lg border p-5 flex flex-col gap-4 transition-all",
                        isActive
                          ? "border-[var(--proofpoint-orange)] bg-[var(--proofpoint-orange)]/5"
                          : "border-border hover:border-muted-foreground/40"
                      )}
                    >
	                      <div className="flex items-start justify-between gap-3">
	                        <div className="min-w-0">
	                          <span className="text-lg font-semibold text-foreground">
	                            {title}
	                          </span>
	                          <p className="mt-1 text-xs text-muted-foreground">
	                            Generated by {generatedBy}
	                          </p>
	                        </div>
	                        <div className="flex items-center gap-2">
	                          {isActive && (
	                            <span className="text-xs px-2 py-0.5 rounded-full bg-background text-muted-foreground border border-border">
	                              Active
	                            </span>
                          )}
                          {didFail && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                              Unavailable
                            </span>
                          )}
                        </div>
	                      </div>

                          {didFail ? (
                            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                              Analysis unavailable
                            </div>
                          ) : (
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
  	                          {displayStatus(result.recommendation ?? "")}
  	                        </span>
  	                      </div>
                          )}

	                      <div className="space-y-1 flex-1">
	                        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
	                          Rationale
	                        </p>
	                      <p className="text-base leading-relaxed text-foreground flex-1">
	                        {result.rationale}
	                      </p>
	                      </div>

	                      <Button
	                        onClick={() => savePreference(result.model, result)}
                          disabled={didFail}
	                        variant={isPreferred ? "default" : "outline"}
	                        className={cn(
	                          "w-full",
	                          isPreferred
	                            ? "bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white border-0"
	                            : ""
	                        )}
	                      >
	                        {isPreferred
	                          ? "Active"
	                          : result.isCurrent
	                            ? "Keep current"
	                            : "Use this analysis"}
	                      </Button>
	                    </div>
	                  );
	                })}
                </div>

                {preferenceSaved && (
                  <p className="text-sm text-emerald-600 text-center mt-4">
                    Preference saved ✓
                  </p>
                )}

                <p className="text-xs text-muted-foreground text-center mt-6">
                  Your preference is logged as evaluation data to help judge which models produce better analyst-ready thesis work.
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
	              Regenerate profile
	            </DialogTitle>
	            <DialogDescription className="text-base text-muted-foreground">
	              {hasProfileEdits
	                ? "Choose whether to use your edited profile fields as context. Optional guidance will be included either way."
	                : "Add optional guidance to focus the regeneration."}
	            </DialogDescription>
	          </DialogHeader>
	          {hasProfileEdits && (
	            <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:border-[var(--proofpoint-orange)]/50 hover:bg-[var(--proofpoint-orange)]/5 transition-colors">
	              <input
	                type="checkbox"
	                checked={includeProfileEdits}
	                onChange={(e) => setIncludeProfileEdits(e.target.checked)}
	                className="mt-1 size-4 rounded border-border accent-[var(--proofpoint-orange)]"
	              />
	              <span>
	                <span className="block text-sm font-semibold text-foreground">
	                  Incorporate my edited profile
	                </span>
	                <span className="mt-0.5 block text-sm text-muted-foreground">
	                  Uses your edited fields as reviewer corrections.
	                </span>
	              </span>
	            </label>
	          )}
	          <div className="pt-2 border-t border-border/40">
	            <label className="text-xs font-medium text-muted-foreground uppercase tracking-[0.08em] block mb-1.5">
	              Additional guidance
	              <span className="ml-1 normal-case font-normal text-muted-foreground/60">
	                (optional)
	              </span>
	            </label>
	            <Textarea
	              value={profileGuidance}
	              onChange={(e) => setProfileGuidance(e.target.value)}
	              placeholder="e.g. focus on the technical architecture, emphasize founder background, more detail on traction metrics..."
	              rows={2}
	              className="resize-none text-sm"
	            />
	            <p className="mt-1.5 text-xs text-muted-foreground">
	              Optional instructions for what the AI should focus on.
	            </p>
	          </div>
	          <DialogFooter className="pt-1">
	            <Button
	              variant="ghost"
	              onClick={() => setShowProfileRegenerateDialog(false)}
	              className="text-muted-foreground hover:text-foreground text-sm"
	            >
	              Cancel
	            </Button>
	            <Button
	              onClick={runProfileRegenerate}
	              className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white border-0"
	            >
	              Regenerate
	            </Button>
	          </DialogFooter>
	        </DialogContent>
	      </Dialog>

	      {/* ── Regenerate thesis dialog ───────────────────────────────────── */}
	      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
	        <DialogContent showCloseButton={false} className="max-w-md">
	          <DialogHeader>
	            <DialogTitle className="font-serif text-xl font-medium">
	              Regenerate thesis fit
	            </DialogTitle>
	            <DialogDescription className="text-base text-muted-foreground">
	              {hasThesisEdit
	                ? "Choose whether to use your edited analysis as context. Optional guidance will be included either way."
	                : "Add optional guidance to focus the regeneration."}
	            </DialogDescription>
	          </DialogHeader>
	          {hasThesisEdit && (
	            <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:border-[var(--proofpoint-orange)]/50 hover:bg-[var(--proofpoint-orange)]/5 transition-colors">
	              <input
	                type="checkbox"
	                checked={includeThesisEdit}
	                onChange={(e) => setIncludeThesisEdit(e.target.checked)}
	                className="mt-1 size-4 rounded border-border accent-[var(--proofpoint-orange)]"
	              />
	              <span>
	                <span className="block text-sm font-semibold text-foreground">
	                  Incorporate my edited analysis
	                </span>
	                <span className="mt-0.5 block text-sm text-muted-foreground">
	                  Uses your current rationale as reviewer context.
	                </span>
	              </span>
	            </label>
	          )}
	          <div className="pt-2 border-t border-border/40">
	            <label className="text-xs font-medium text-muted-foreground uppercase tracking-[0.08em] block mb-1.5">
	              Additional guidance
	              <span className="ml-1 normal-case font-normal text-muted-foreground/60">
	                (optional)
	              </span>
	            </label>
	            <Textarea
	              value={thesisGuidance}
	              onChange={(e) => setThesisGuidance(e.target.value)}
	              placeholder="e.g. be more critical, focus on competitive landscape, assess founder-market fit in depth..."
	              rows={2}
	              className="resize-none text-sm"
	            />
	            <p className="mt-1.5 text-xs text-muted-foreground">
	              Optional instructions for what the AI should focus on.
	            </p>
	          </div>
	          <DialogFooter className="pt-1">
	            <Button
	              variant="ghost"
	              onClick={() => setShowRegenerateDialog(false)}
	              className="text-muted-foreground hover:text-foreground text-sm"
	            >
	              Cancel
	            </Button>
	            <Button
	              onClick={runRegenerate}
	              className="bg-[var(--proofpoint-orange)] hover:bg-[var(--proofpoint-orange)]/90 text-white border-0"
	            >
	              Regenerate
	            </Button>
	          </DialogFooter>
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
