import { z } from "zod";

export const CompanyStatusSchema = z.enum([
  "NEW",
  "REVIEWING",
  "PRIORITY",
  "FOLLOW_UP",
  "PASS",
]);
export type CompanyStatus = z.infer<typeof CompanyStatusSchema>;

export const CompanyProfileSchema = z.object({
  description: z.string(),
  productSummary: z.string(),
  targetCustomer: z.string(),
  verticalTags: z.array(z.string()),
  signalsExtracted: z.array(z.string()),
  _meta: z.object({
    model: z.string(),
    generatedAt: z.string(),
    promptVersion: z.string(),
    fallback: z.boolean().default(false),
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
  }),
});
export type ThesisFit = z.infer<typeof ThesisFitSchema>;

export const RelevanceFilterSchema = z.object({
  relevant: z.boolean(),
  companyName: z.string().nullable(),
  oneLiner: z.string().nullable(),
  reason: z.string(),
});
export type RelevanceFilter = z.infer<typeof RelevanceFilterSchema>;