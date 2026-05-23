import { z } from "zod";

export const SignalItemSchema = z.object({
  text: z.string(),
  source: z.enum(["ai", "analyst"]),
  addedAt: z.string().optional(),
  sourceUrl: z.string().optional(),
});
export type SignalItem = z.infer<typeof SignalItemSchema>;

export function normalizeSignals(
  signals: (string | SignalItem)[],
  sourceUrl?: string
): SignalItem[] {
  return signals.map((s) =>
    typeof s === "string"
      ? { text: s, source: "ai" as const, sourceUrl }
      : { ...s, sourceUrl: s.sourceUrl ?? sourceUrl }
  );
}

export const NEXT_STEP_OPTIONS = [
  "Reach out to founder",
  "Request pitch deck",
  "Schedule partner intro",
  "Conduct reference checks",
  "Add to watch list",
  "Follow up next quarter",
  "Pass — send decline note",
  "Custom…",
] as const;

export const CompanyStatusSchema = z.enum([
  "NEW",
  "REVIEWING",
  "PRIORITY_FOLLOW_UP",
  "PASS",
]);
export type CompanyStatus = z.infer<typeof CompanyStatusSchema>;

export const CompanyProfileSchema = z.object({
  description: z.string(),
  productSummary: z.string(),
  targetCustomer: z.string(),
  verticalTags: z.array(z.string()),
  signalsExtracted: z.array(z.union([z.string(), SignalItemSchema])),
  stage: z.string().nullable(),
  _meta: z.object({
    model: z.string(),
    generatedAt: z.string(),
    promptVersion: z.string(),
    fallback: z.boolean().default(false),
    analystGuidance: z.string().optional(),
  }),
});
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

export const ThesisFitSchema = z.object({
  score: z.number().min(1).max(10),
  recommendation: CompanyStatusSchema,
  rationale: z.string(),
  _meta: z.object({
    model: z.string(),
    generatedAt: z.string(),
    promptVersion: z.string(),
    fallback: z.boolean().default(false),
    analystGuidance: z.string().optional(),
  }),
});
export type ThesisFit = z.infer<typeof ThesisFitSchema>;

export const CompanyAnalysisSchema = z.object({
  profile: CompanyProfileSchema.omit({ _meta: true }),
  thesisFit: ThesisFitSchema.omit({ _meta: true }),
});
export type CompanyAnalysis = z.infer<typeof CompanyAnalysisSchema>;

export const RelevanceFilterSchema = z.object({
  relevant: z.boolean(),
  companyName: z.string().nullable(),
  oneLiner: z.string().nullable(),
  reason: z.string(),
});
export type RelevanceFilter = z.infer<typeof RelevanceFilterSchema>;

export const AgentPlannerSchema = z.object({
  reasoning: z.string(),
  query: z.string(),
  done: z.boolean(),
});
export type AgentPlannerOutput = z.infer<typeof AgentPlannerSchema>;
