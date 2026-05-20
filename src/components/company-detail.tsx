"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PencilIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import type { CompanyStatus, CompanyProfile, ThesisFit } from "@/lib/types";

const ALL_STATUSES: CompanyStatus[] = [
  "NEW",
  "REVIEWING",
  "PRIORITY",
  "FOLLOW_UP",
  "PASS",
];

type SerializedNote = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

export type CompanyDetailProps = {
  id: string;
  name: string;
  website: string | null;
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
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {isEdited ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
          Edited
        </span>
      ) : (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          AI
        </span>
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
    <div className="group/field space-y-1.5">
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
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="xs" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed">{value}</p>
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
    <div className="group/field space-y-1.5">
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
            <Button size="xs" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saving}
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
      size="sm"
      onClick={onRegenerate}
      disabled={regenerating || regenerateDisabled}
      className={regenerateDisabled ? "pointer-events-none" : undefined}
      tabIndex={regenerateDisabled ? -1 : 0}
    >
      {regenerating ? (
        <Loader2Icon className="size-3.5 animate-spin" />
      ) : (
        <RefreshCwIcon className="size-3.5" />
      )}
      {regenerating ? "Generating…" : "Regenerate"}
    </Button>
  );

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground ring-1 ring-foreground/10">
            <SparklesIcon className="size-2.5" />
            AI-Generated
          </span>
          {meta && (
            <span className="text-[11px] text-muted-foreground">
              {meta.model} · {new Date(meta.generatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
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

// ── Main component ────────────────────────────────────────────────────────────

export function CompanyDetail({
  id,
  name,
  website,
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

  const [noteText, setNoteText] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [isRegeneratingProfile, setIsRegeneratingProfile] = useState(false);
  const [isRegeneratingThesisFit, setIsRegeneratingThesisFit] = useState(false);

  async function handleRegenerateProfile() {
    setIsRegeneratingProfile(true);
    try {
      const res = await fetch(`/api/companies/${id}/profile`, { method: "POST" });
      if (res.ok) {
        toast.success("Profile regenerated");
        router.refresh();
      } else {
        toast.error("Failed to regenerate profile");
      }
    } finally {
      setIsRegeneratingProfile(false);
    }
  }

  async function handleRegenerateThesisFit() {
    setIsRegeneratingThesisFit(true);
    try {
      const res = await fetch(`/api/companies/${id}/thesis-fit`, { method: "POST" });
      if (res.ok) {
        toast.success("Thesis fit regenerated");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to regenerate thesis fit");
      }
    } finally {
      setIsRegeneratingThesisFit(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    const res = await fetch(`/api/companies/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      toast.success("Status updated");
      router.refresh();
    } else {
      toast.error("Failed to update status");
    }
  }

  async function handleNextStepBlur(
    e: React.FocusEvent<HTMLInputElement>
  ) {
    const value = e.currentTarget.value;
    const original = nextStep ?? "";
    if (value === original) return;
    const res = await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "nextStep", value, section: "company" }),
    });
    if (res.ok) {
      toast.success("Next step saved");
    } else {
      toast.error("Failed to save next step");
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

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">{name}</h1>
          <StatusBadge status={status as CompanyStatus} />
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-36" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-primary"
            >
              {website}
            </a>
          )}
          {vertical && <span>· {vertical}</span>}
          {stage && <span>· {stage}</span>}
        </div>

        {oneLiner && <p className="text-sm">{oneLiner}</p>}

        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            Next step
          </span>
          <Input
            defaultValue={nextStep ?? ""}
            onBlur={handleNextStepBlur}
            placeholder="e.g. Schedule intro call"
            className="max-w-xs"
          />
        </div>
      </div>

      {/* ── Profile card ───────────────────────────────────────────────── */}
      <section className="rounded-xl bg-muted/30 ring-1 ring-foreground/10 p-5 space-y-5">
        <AiCardHeader
          title="Company Profile"
          meta={profile?._meta}
          onRegenerate={handleRegenerateProfile}
          regenerating={isRegeneratingProfile}
          regenerateDisabled={false}
        />
        {profile ? (
          <>
            <EditableTextField
              label="Description"
              value={profile.description}
              field="description"
              section="profile"
              companyId={id}
              isEdited={humanEdits?.["profile.description"] ?? false}
              onRefresh={refresh}
            />
            <EditableTextField
              label="Product Summary"
              value={profile.productSummary}
              field="productSummary"
              section="profile"
              companyId={id}
              isEdited={humanEdits?.["profile.productSummary"] ?? false}
              onRefresh={refresh}
            />
            <EditableTextField
              label="Target Customer"
              value={profile.targetCustomer}
              field="targetCustomer"
              section="profile"
              companyId={id}
              isEdited={humanEdits?.["profile.targetCustomer"] ?? false}
              onRefresh={refresh}
            />
            <EditableArrayField
              label="Vertical Tags"
              values={profile.verticalTags}
              field="verticalTags"
              section="profile"
              companyId={id}
              isEdited={humanEdits?.["profile.verticalTags"] ?? false}
              onRefresh={refresh}
              renderDisplay={(vals) => (
                <div className="flex flex-wrap gap-1.5">
                  {vals.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            />
            <EditableArrayField
              label="Signals Extracted"
              values={profile.signalsExtracted}
              field="signalsExtracted"
              section="profile"
              companyId={id}
              isEdited={humanEdits?.["profile.signalsExtracted"] ?? false}
              onRefresh={refresh}
              renderDisplay={(vals) => (
                <ul className="space-y-1">
                  {vals.map((signal, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-muted-foreground shrink-0">·</span>
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              )}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No profile yet — run a scan to generate.
          </p>
        )}
      </section>

      {/* ── Thesis Fit card ────────────────────────────────────────────── */}
      <section className="rounded-xl bg-muted/30 ring-1 ring-foreground/10 p-5 space-y-5">
        <AiCardHeader
          title="Thesis Fit"
          meta={thesisFit?._meta}
          onRegenerate={handleRegenerateThesisFit}
          regenerating={isRegeneratingThesisFit}
          regenerateDisabled={!profile}
          regenerateDisabledTooltip={!profile ? "Generate profile first" : undefined}
        />
        {thesisFit ? (
          <>
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center justify-center rounded-lg bg-card ring-1 ring-foreground/10 px-6 py-3 min-w-[80px]">
                <span className="text-4xl font-bold tabular-nums leading-none">
                  {thesisFit.score}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  / 10
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recommendation
                </span>
                <div>
                  <StatusBadge status={thesisFit.recommendation} />
                </div>
              </div>
            </div>
            <EditableTextField
              label="Rationale"
              value={thesisFit.rationale}
              field="rationale"
              section="thesisFit"
              companyId={id}
              isEdited={humanEdits?.["thesisFit.rationale"] ?? false}
              onRefresh={refresh}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No thesis fit yet — run a scan to generate.
          </p>
        )}
      </section>

      {/* ── Reviewer Notes card ─────────────────────────────────────────── */}
      <section className="rounded-xl bg-card ring-1 ring-foreground/10 border-l-[3px] border-l-blue-400 overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Reviewer Notes</h2>
            <span className="text-xs text-muted-foreground">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
          </div>

          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-muted/40 rounded-lg px-3 py-2.5"
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {note.body}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {note.author} ·{" "}
                    {new Date(note.createdAt).toLocaleString()}
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
              className="text-sm"
              disabled={noteSubmitting}
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={noteSubmitting || !noteText.trim()}
            >
              {noteSubmitting ? "Adding…" : "Add note"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
