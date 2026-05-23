function matchCanonicalStage(lower: string): string | null {
  if (/\bseries\s+f\b/.test(lower)) return "Series F";
  if (/\bseries\s+e\b/.test(lower)) return "Series E";
  if (/\bseries\s+d\b/.test(lower)) return "Series D";
  if (/\bseries\s+c\b/.test(lower)) return "Series C";
  if (/\bseries\s+b\b/.test(lower)) return "Series B";
  if (/\bseries\s+a\b/.test(lower)) return "Series A";
  if (/\bpre[\s-]?seed\b/.test(lower)) return "Pre-seed";
  if (/\bseed\s+(round|funding|stage)\b/.test(lower)) return "Seed";
  if (/\b(raised|raises)\b.{0,40}\bseed\b/.test(lower)) return "Seed";
  // Only match stealth when the company is CURRENTLY in stealth.
  // "out of stealth", "exits stealth", "emerges from stealth" mean the company is exiting — not in stealth.
  if (!/\b(out of|exits?|emerges? from|launching? out of)\s+stealth\b/.test(lower)) {
    if (/\b(in stealth|stealth mode|stealth[\s-]?(startup|company|operation))\b/.test(lower)) {
      return "Stealth";
    }
  }
  return null;
}

export function normalizeStageValue(stage: string | null | undefined): string | null {
  if (!stage) return null;
  return matchCanonicalStage(stage.toLowerCase());
}

export function detectStage(text: string | null): string | null {
  if (!text) return null;
  return matchCanonicalStage(text.toLowerCase());
}
