export type QueryConstraints = {
  verticals: string[];
  stages: string[];
  days: number;
  timeLabel: string;
};

const VERTICAL_PATTERNS = [
  {
    keywords: ["healthcare", "health", "clinical", "medical", "hospital", "patient"],
    canonical: "healthcare",
  },
  {
    keywords: [
      "fintech", "financial", "banking", "insurance", "underwriting",
      "lending", "claims", "payments", "investment",
    ],
    canonical: "fintech",
  },
  {
    keywords: [
      "life sciences", "biotech", "pharma", "drug discovery",
      "genomics", "clinical trials",
    ],
    canonical: "life sciences",
  },
];

const STAGE_PATTERNS = [
  { keywords: ["pre-seed", "preseed"], canonical: "Pre-seed" },
  { keywords: ["seed"], canonical: "Seed" },
  { keywords: ["series a"], canonical: "Series A" },
  { keywords: ["series b"], canonical: "Series B" },
  { keywords: ["series c"], canonical: "Series C" },
  { keywords: ["stealth"], canonical: "Stealth" },
];

export function extractConstraints(query: string): QueryConstraints {
  const lower = query.toLowerCase();

  const verticals: string[] = [];
  for (const { keywords, canonical } of VERTICAL_PATTERNS) {
    if (keywords.some(kw => lower.includes(kw)) && !verticals.includes(canonical)) {
      verticals.push(canonical);
    }
  }

  const stages: string[] = [];
  for (const { keywords, canonical } of STAGE_PATTERNS) {
    if (keywords.some(kw => lower.includes(kw)) && !stages.includes(canonical)) {
      stages.push(canonical);
    }
  }

  let days = 180;
  let timeLabel = "last 6 months (default)";

  if (/\blast\s+(\d+)\s+months?\b/.test(lower)) {
    const m = lower.match(/\blast\s+(\d+)\s+months?\b/);
    const n = parseInt(m![1], 10);
    days = Math.min(365, n * 30);
    timeLabel = `last ${n} ${n === 1 ? "month" : "months"}`;
  } else if (/\blast\s+(\d+)\s+weeks?\b/.test(lower)) {
    const m = lower.match(/\blast\s+(\d+)\s+weeks?\b/);
    const n = parseInt(m![1], 10);
    days = Math.min(365, n * 7);
    timeLabel = `last ${n} ${n === 1 ? "week" : "weeks"}`;
  } else if (/\bthis\s+year\b/.test(lower) || /\b2026\b/.test(lower)) {
    days = 180;
    timeLabel = "this year";
  } else if (/\blast\s+year\b/.test(lower) || /\b2025\b/.test(lower)) {
    days = 365;
    timeLabel = "last year";
  } else if (/\brecent\b/.test(lower) || /\blately\b/.test(lower)) {
    days = 90;
    timeLabel = "recent (last 3 months)";
  }

  return { verticals, stages, days, timeLabel };
}

export function stripConstraintNoise(query: string): string {
  return query
    .replace(/\b20\d{2}\b/g, "")
    .replace(/\blast\s+\d+\s+(?:days?|months?|years?)\b/gi, "")
    .replace(/\blast\s+(?:month|year|half[\s-]year|half year)\b/gi, "")
    .replace(/\blast\s+3\s+months?\b/gi, "")
    .replace(/\blast\s+6\s+months?\b/gi, "")
    .replace(/\blast\s+12\s+months?\b/gi, "")
    .replace(/\brecently\b/gi, "")
    .replace(/\brecent\b/gi, "")
    .replace(/\blatest\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
