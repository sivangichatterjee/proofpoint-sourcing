export type QueryConstraints = {
  verticals: string[];
  stages: string[];
  stageLabels: string[];
  geographies: string[];
  focusTerms: string[];
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
  {
    patterns: [/\bearly[\s-]?stage\b/i, /\bearlier[\s-]?stage\b/i],
    canonicals: ["Pre-seed", "Seed", "Series A", "Series B"],
    label: "early stage",
  },
  {
    patterns: [/\bpre[\s-]?seed\b/i],
    canonicals: ["Pre-seed"],
    label: "Pre-seed",
  },
  {
    patterns: [/(?<!pre[\s-])\bseed\b/i],
    canonicals: ["Seed"],
    label: "Seed",
  },
  {
    patterns: [/\bseries\s+a\b/i],
    canonicals: ["Series A"],
    label: "Series A",
  },
  {
    patterns: [/\bseries\s+b\b/i],
    canonicals: ["Series B"],
    label: "Series B",
  },
  {
    patterns: [/\bseries\s+c\b/i],
    canonicals: ["Series C"],
    label: "Series C",
  },
  {
    patterns: [/\bstealth\b/i],
    canonicals: ["Stealth"],
    label: "Stealth",
  },
] as const;

const GEOGRAPHY_PATTERNS = [
  { patterns: [/\busa\b/i, /\bu\.s\.a\.?\b/i, /\bu\.s\.?\b/i, /\bunited states\b/i, /\bamerica(?:n)?\b/i], canonical: "United States" },
  { patterns: [/\buk\b/i, /\bu\.k\.?\b/i, /\bunited kingdom\b/i, /\bbritain\b/i, /\bbritish\b/i], canonical: "United Kingdom" },
  { patterns: [/\beurope\b/i, /\beuropean\b/i, /\beu\b/i], canonical: "Europe" },
  { patterns: [/\bindia\b/i, /\bindian\b/i], canonical: "India" },
  { patterns: [/\bisrael\b/i, /\bisraeli\b/i], canonical: "Israel" },
  { patterns: [/\bcanada\b/i, /\bcanadian\b/i], canonical: "Canada" },
  { patterns: [/\blatam\b/i, /\blatin america\b/i], canonical: "Latin America" },
];

const FOCUS_TERM_PATTERNS = [
  { patterns: [/\bclinical\s+nlp\b/i], canonical: "clinical NLP" },
  { patterns: [/\bclinical\s+documentation\b/i, /\bmedical\s+scribe\b/i, /\bai\s+scribe\b/i], canonical: "clinical documentation" },
  { patterns: [/\bprior\s+authorization\b/i, /\bprior\s+auth\b/i], canonical: "prior authorization" },
  { patterns: [/\brevenue\s+cycle\b/i], canonical: "revenue cycle" },
  { patterns: [/\binsurance\s+underwriting\b/i, /\bunderwriting\b/i], canonical: "insurance underwriting" },
  { patterns: [/\bclaims?\s+(processing|adjudication|auditing|automation)\b/i], canonical: "claims processing" },
  { patterns: [/\bfraud\s+detection\b/i], canonical: "fraud detection" },
  { patterns: [/\bregulatory\s+compliance\b/i, /\bcompliance\b/i], canonical: "regulatory compliance" },
  { patterns: [/\bdrug\s+discovery\b/i], canonical: "drug discovery" },
  { patterns: [/\bclinical\s+trials?\b/i], canonical: "clinical trials" },
  { patterns: [/\bgenomics?\b/i], canonical: "genomics" },
  { patterns: [/\bmedical\s+imaging\b/i, /\bradiology\b/i], canonical: "medical imaging" },
  { patterns: [/\bdesign\s+partners?\b/i], canonical: "design partners" },
  { patterns: [/\bhospital\s+pilots?\b/i, /\bpilots?\b/i], canonical: "pilots" },
  { patterns: [/\bpaying\s+customers?\b/i], canonical: "paying customers" },
  { patterns: [/\bfda[\s-]?cleared\b/i], canonical: "FDA-cleared" },
  { patterns: [/\bllm\s+agents?\b/i, /\bagentic\b/i], canonical: "LLM agents" },
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
  const stageLabels: string[] = [];
  for (const { patterns, canonicals, label } of STAGE_PATTERNS) {
    if (!patterns.some((pattern) => pattern.test(query))) continue;

    if (!stageLabels.includes(label)) {
      stageLabels.push(label);
    }

    for (const canonical of canonicals) {
      if (!stages.includes(canonical)) {
        stages.push(canonical);
      }
    }
  }

  const geographies: string[] = [];
  for (const { patterns, canonical } of GEOGRAPHY_PATTERNS) {
    if (patterns.some(pattern => pattern.test(query)) && !geographies.includes(canonical)) {
      geographies.push(canonical);
    }
  }

  const focusTerms: string[] = [];
  for (const { patterns, canonical } of FOCUS_TERM_PATTERNS) {
    if (patterns.some(pattern => pattern.test(query)) && !focusTerms.includes(canonical)) {
      focusTerms.push(canonical);
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

  return { verticals, stages, stageLabels, geographies, focusTerms, days, timeLabel };
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
