import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
const authToken =
  process.env.TURSO_AUTH_TOKEN ?? process.env.LIBSQL_DATABASE_TOKEN;

if (!url) {
  throw new Error("Missing database URL. Set TURSO_DATABASE_URL or DATABASE_URL.");
}

const adapter = new PrismaLibSql({
  url,
  ...(authToken ? { authToken } : {}),
});
const prisma = new PrismaClient({ adapter });
const now = new Date().toISOString();

const companies = [
  {
    name: "Sixfold AI",
    website: "https://sixfold.ai",
    oneLiner: "Generative AI underwriting platform for P&C and life insurers",
    vertical: "Fintech",
    stage: "Series B",
    status: "PRIORITY_FOLLOW_UP",
    sourceUrl: "https://fintech.global/2026/01/30/insurtech-firm-sixfold-secures-30m-to-advance-ai-underwriting/",
    rawScrapedText:
      "Sixfold, an AI underwriting InsurTech, has raised $30M in Series B funding led by Brewer Lane, with strategic backing from Guidewire. Existing investors Bessemer Venture Partners and Salesforce Ventures also participated. The New York-based firm has processed over 1 million submissions across 40+ lines of business for global insurers representing $265 billion in gross written premium, including Zurich North America (200+ underwriters), Skyward Specialty, Guardian, and General. Skyward reduced quote response time by 35%. Zurich saves up to 2 hours per submission. Founded by Alex Schmelkin (CEO), Jane Tran (COO), and Brian Moseley. Total funding now $52M across Seed (May 2023, Bessemer-led), Series A ($15M, June 2024, Salesforce Ventures-led), and Series B (January 2026). Building 'AI Underwriter' — autonomous agents handling end-to-end underwriting.",
    profile: JSON.stringify({
      description:
        "Sixfold builds a generative AI platform that automates and augments insurance underwriting for property & casualty and life insurers.",
      productSummary:
        "Sixfold's AI ingests underwriting submissions, extracts structured risk data from unstructured documents, and generates tailored insights aligned with each insurer's risk appetite. The platform integrates directly into existing underwriter workbenches and policy administration systems, enabling deployment without workflow changes.",
      targetCustomer:
        "P&C and life insurance carriers, MGAs, and reinsurers — especially mid-to-large carriers with high submission volumes. Buyers are typically Chief Underwriting Officers or VPs of Underwriting Operations.",
      verticalTags: ["Insurance AI", "Underwriting Automation", "InsurTech", "Risk Assessment", "P&C Insurance"],
      signalsExtracted: [
        { text: "$30M Series B (Jan 2026) led by Brewer Lane, total funding $52M", source: "ai", sourceUrl: "https://fintech.global/2026/01/30/insurtech-firm-sixfold-secures-30m-to-advance-ai-underwriting/" },
        { text: "Strategic investment from Guidewire, the dominant P&C core systems vendor", source: "ai", sourceUrl: "https://fintech.global/2026/01/30/insurtech-firm-sixfold-secures-30m-to-advance-ai-underwriting/" },
        { text: "Customers include Zurich North America (200+ underwriters), Skyward Specialty, Guardian", source: "ai", sourceUrl: "https://fintech.global/2026/01/30/insurtech-firm-sixfold-secures-30m-to-advance-ai-underwriting/" },
        { text: "Skyward Specialty reduced quote response time by 35% after deployment", source: "ai", sourceUrl: "https://fintech.global/2026/01/30/insurtech-firm-sixfold-secures-30m-to-advance-ai-underwriting/" },
        { text: "Processed 1M+ submissions across 40+ lines of business representing $265B in gross written premium", source: "ai", sourceUrl: "https://fintech.global/2026/01/30/insurtech-firm-sixfold-secures-30m-to-advance-ai-underwriting/" },
        { text: "Founders Alex Schmelkin (CEO, repeat insurance entrepreneur), Jane Tran (COO, finance + startup ops), Brian Moseley (technical lead)", source: "ai", sourceUrl: "https://fintech.global/2026/01/30/insurtech-firm-sixfold-secures-30m-to-advance-ai-underwriting/" },
      ],
      stage: "Series B",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v1", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 9,
      recommendation: "PRIORITY_FOLLOW_UP",
      rationale:
        "Exceptional thesis fit. Sixfold is exactly the kind of Vertical AI company Proofpoint should be tracking: AI-native (not retrofitted), embedded in a regulated workflow (insurance underwriting), demonstrable ROI metrics with named enterprise customers, and a strategic investor (Guidewire) that creates distribution lock-in. The 35% quote time reduction at Skyward and 2-hour-per-submission savings at Zurich are concrete value props. Series B at $30M is later than our typical entry, but the trajectory and the moat justify monitoring for follow-on opportunities or relationship-building.",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v3", fallback: false },
    }),
  },
  {
    name: "Aidoc",
    website: "https://www.aidoc.com",
    oneLiner: "Clinical AI foundation model for radiology, cardiology, and vascular disease triage",
    vertical: "Healthcare",
    stage: "Series E",
    status: "PASS",
    sourceUrl: "https://www.mobihealthnews.com/news/aidoc-secures-150m-scale-ai-imaging-tools",
    rawScrapedText:
      "Aidoc has raised $150M in Series E funding led by Growth Equity at Goldman Sachs Alternatives, with General Catalyst, SoftBank Vision Fund 2, and NVentures (NVIDIA's VC arm) participating. Total raised exceeds $500M. The New York and Tel Aviv-based company supports radiologists for over 60 million patients annually across 150+ health systems including Hartford HealthCare, Mercy, Sutter Health, and WellSpan. Aidoc has 17 FDA-cleared algorithms, including its CARE clinical foundation model which received FDA clearance for CT-based triage across 11 indications. Founded 2016 by Elad Walach (CEO). Funding rounds: Series B $27M (2019), Series C $66M (2021), Series D $110M (2022), growth $30M (2023), growth $150M (July 2025), Series E $150M (April 2026). Reportedly considering IPO.",
    profile: JSON.stringify({
      description:
        "Aidoc develops a clinical AI foundation model that helps radiologists detect, triage, and report on imaging findings across CT, X-ray, and other modalities.",
      productSummary:
        "Aidoc's aiOS platform analyzes medical imaging in real time, flags time-critical findings, automates triage workflows across radiology and cardiology, and is moving toward end-to-end pixel-to-draft-report automation. The CARE foundation model is trained on broad clinical data and adapts to new conditions 20x faster than single-use models.",
      targetCustomer:
        "Large U.S. and international health systems, hospital networks, and academic medical centers — especially those with high imaging volumes. Buyers are CMIOs, Chief Radiology Officers, and IT leadership.",
      verticalTags: ["Clinical AI", "Radiology AI", "Medical Imaging", "Foundation Models", "Healthcare AI"],
      signalsExtracted: [
        { text: "$150M Series E (April 2026) led by Goldman Sachs Growth, total funding $500M+", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/aidoc-secures-150m-scale-ai-imaging-tools" },
        { text: "17 FDA-cleared algorithms including CARE foundation model with 11-indication CT triage clearance", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/aidoc-secures-150m-scale-ai-imaging-tools" },
        { text: "Customers include Hartford HealthCare, Mercy, Sutter Health, WellSpan — 150+ health systems total", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/aidoc-secures-150m-scale-ai-imaging-tools" },
        { text: "60M patients per year supported, 110M+ patient cases reviewed across 2,000 hospitals", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/aidoc-secures-150m-scale-ai-imaging-tools" },
        { text: "NVIDIA strategic investment via NVentures plus AWS partnership", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/aidoc-secures-150m-scale-ai-imaging-tools" },
        { text: "Founded 2016 by Elad Walach, reported IPO consideration", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/aidoc-secures-150m-scale-ai-imaging-tools" },
      ],
      stage: "Series E",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v1", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 4,
      recommendation: "PASS",
      rationale:
        "Aidoc is a clear category leader in clinical imaging AI but is well past Proofpoint's typical early-stage entry point. With $500M+ in total funding, IPO consideration, and 150+ deployed health systems, valuation expectations and growth dynamics are no longer compatible with a Seed-to-Series B fund's economics. We pass on this one but should track the talent diaspora — early Aidoc engineers and clinical leads will spin out future companies that are squarely in our sweet spot.",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v3", fallback: false },
    }),
  },
  {
    name: "Cohere Health",
    website: "https://www.coherehealth.com",
    oneLiner: "AI-driven prior authorization platform for health plans and providers",
    vertical: "Healthcare",
    stage: "Series C",
    status: "PASS",
    sourceUrl: "https://www.fiercehealthcare.com/ai-and-machine-learning/cohere-health-lands-90m-series-c-round-expand-ai-use-cases",
    rawScrapedText:
      "Cohere Health raised $90M Series C in May 2025 led by Temasek. Total funding $200M. Processes 12M+ prior auth requests annually, auto-approves up to 90% of requests. Cohere Health, a Boston-based AI company that uses machine learning to streamline prior authorization decisions, has raised $50M in a Series C debt and equity round led by Deerfield Management. The platform serves major health plans including Humana, processing millions of prior authorization requests annually. Cohere's AI predicts the likelihood of approval based on clinical guidelines, automates routine approvals, and provides real-time decision support to providers at point-of-care. The company was founded in 2019 by Siva Namasivayam (CEO, former CEO of Reflexion Health), Kishore Nimmagadda (CTO), and Brett Rosen (COO). Total funding now exceeds $156M including Series A $20M (2020), Series B $36M (2021), and the recent $50M round. Customers include Humana (multi-million-member contract), several Blue Cross Blue Shield plans, and regional payers.",
    profile: JSON.stringify({
      description:
        "Cohere Health uses AI to automate prior authorization decisions, reducing administrative burden for both health plans and providers while accelerating patient access to care.",
      productSummary:
        "Cohere's platform ingests prior authorization requests, applies clinical guidelines via machine learning models, and instantly approves routine cases or routes complex ones to human reviewers with structured context. Real-time provider-facing decision support helps physicians submit complete requests upfront, reducing denials and rework.",
      targetCustomer:
        "Health plans (national and regional payers) seeking to reduce prior auth processing costs and member friction. Buyers are typically Chief Medical Officers, VPs of Utilization Management, or Chief Operations Officers at payer organizations.",
      verticalTags: ["Prior Authorization", "Payer AI", "Utilization Management", "Healthcare AI", "Clinical Decision Support"],
      signalsExtracted: [
        { text: "$90M Series C (May 2025) led by Temasek, total funding $200M", source: "ai", sourceUrl: "https://www.fiercehealthcare.com/ai-and-machine-learning/cohere-health-lands-90m-series-c-round-expand-ai-use-cases" },
        { text: "Multi-million-member contract with Humana as anchor customer", source: "ai", sourceUrl: "https://www.fiercehealthcare.com/ai-and-machine-learning/cohere-health-lands-90m-series-c-round-expand-ai-use-cases" },
        { text: "Customers include Humana and several Blue Cross Blue Shield plans", source: "ai", sourceUrl: "https://www.fiercehealthcare.com/ai-and-machine-learning/cohere-health-lands-90m-series-c-round-expand-ai-use-cases" },
        { text: "Founders Siva Namasivayam (CEO, former Reflexion Health CEO), Kishore Nimmagadda (CTO), Brett Rosen (COO)", source: "ai", sourceUrl: "https://www.fiercehealthcare.com/ai-and-machine-learning/cohere-health-lands-90m-series-c-round-expand-ai-use-cases" },
        { text: "Processes 12M+ prior authorization requests annually, auto-approves up to 90% of requests", source: "ai", sourceUrl: "https://www.fiercehealthcare.com/ai-and-machine-learning/cohere-health-lands-90m-series-c-round-expand-ai-use-cases" },
        { text: "Reduces administrative burden on both payer and provider sides — bilateral value prop", source: "ai", sourceUrl: "https://www.fiercehealthcare.com/ai-and-machine-learning/cohere-health-lands-90m-series-c-round-expand-ai-use-cases" },
      ],
      stage: "Series C",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v1", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 4,
      recommendation: "PASS",
      rationale:
        "Cohere Health is a strong company in a real Vertical AI workflow: prior authorization is painful, the product has clear payer adoption, and the platform processes 12M+ requests annually with high auto-approval rates. However, Series C at roughly $200M in total funding places the company outside Proofpoint's core Pre-seed-to-Series B entry window. This looks like a category leader worth tracking for market context, but not a fit for this fund right now.",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v3", fallback: false },
    }),
  },
  {
    name: "Keebler Health",
    website: "https://www.mobihealthnews.com/news/keebler-health-raises-16m-ai-risk-adjustment-platform",
    oneLiner:
      "Keebler Health develops an AI risk adjustment platform analyzing electronic health records to identify chronic conditions for value-based care models",
    vertical: "Healthcare",
    stage: "Series A",
    status: "PRIORITY_FOLLOW_UP",
    sourceUrl: "https://www.mobihealthnews.com/news/keebler-health-raises-16m-ai-risk-adjustment-platform",
    rawScrapedText:
      "# Keebler Health raises $16M for AI risk adjustment platform. Keebler Health, an AI-enabled risk adjustment company, announced it has secured $16 million in Series A funding, bringing its total raise to $23 million. North Carolina-based Keebler Health's platform analyzes electronic health records and other patient data to identify chronic conditions that may be missing or undocumented in existing documentation. The company's tools aim to support value-based care models and help providers with risk adjustment and reimbursement. Last year, Keebler Health raised $6 million in seed funding, bringing its total raise at the time to $7.8 million. Another company in the space is an AI-enabled clinical intelligence platform for primary care providers, Navina, which in March announced the close of a $55 million Series C funding round, bringing its total raise to $100 million. New York-based Navina offers accountable care organizations, providers, management services organizations and health plans AI-enabled tools for risk adjustment, chart review, quality management and analytics to help track and optimize value-based care performance.",
    profile: JSON.stringify({
      description:
        "Keebler Health is an AI-enabled risk adjustment company that analyzes electronic health records to identify chronic conditions for value-based care models.",
      productSummary:
        "Keebler Health's platform uses AI to analyze patient data from electronic health records to identify missing or undocumented chronic conditions, supporting risk adjustment and reimbursement for providers. The platform aims to help providers with value-based care models. By analyzing patient data, Keebler Health's tools enable more accurate risk adjustment and reimbursement.",
      targetCustomer:
        "The target customer for Keebler Health is likely healthcare providers, particularly those involved in value-based care models, who need to accurately identify and document patient conditions for risk adjustment and reimbursement.",
      verticalTags: ["Healthcare", "Risk Adjustment", "Value-Based Care"],
      signalsExtracted: [
        { text: "$16 million Series A funding", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/keebler-health-raises-16m-ai-risk-adjustment-platform" },
        { text: "$23 million total funding", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/keebler-health-raises-16m-ai-risk-adjustment-platform" },
        { text: "AI-enabled risk adjustment platform", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/keebler-health-raises-16m-ai-risk-adjustment-platform" },
        { text: "analyzes electronic health records", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/keebler-health-raises-16m-ai-risk-adjustment-platform" },
        { text: "supports value-based care models", source: "ai", sourceUrl: "https://www.mobihealthnews.com/news/keebler-health-raises-16m-ai-risk-adjustment-platform" },
      ],
      stage: "Series A",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v2", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 8.5,
      recommendation: "PRIORITY_FOLLOW_UP",
      rationale:
        "Keebler Health demonstrates a strong fit with Proofpoint's investment thesis, given its clear focus on the healthcare vertical, specifically risk adjustment and value-based care. The company's AI-enabled platform and $16 million Series A funding round are notable signals. To move the score up, evidence of named brand-name design partners or significant ARR growth would be necessary. Despite being a strong company, no weaknesses in fit for the fund's thesis were identified.",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v3", fallback: false },
    }),
  },
  {
    name: "Tempus AI",
    website: "https://www.tempus.com",
    oneLiner: "Precision medicine platform combining clinical and molecular data for oncology and beyond",
    vertical: "Life Sciences",
    stage: "Series H",
    status: "PASS",
    sourceUrl: "https://www.businesswire.com/news/home/20240613047150/en/Tempus-AI-Announces-Pricing-of-Initial-Public-Offering",
    rawScrapedText:
      "Tempus AI went public on Nasdaq in June 2024 at a $6.1B valuation, raising $410M in its IPO. The Chicago-based precision medicine company combines clinical and molecular data to enable AI-driven insights for oncology, neuropsychiatry, cardiology, and infectious disease. Founded in 2015 by Eric Lefkofsky (CEO, also co-founder of Groupon). The company sequences DNA and RNA from cancer patients, builds the largest library of clinical and molecular data in oncology, and partners with pharma companies for drug development. Pre-IPO Tempus raised over $1.3B in private funding across multiple rounds, including a $200M Series G in 2022 led by Google. Customers include 95%+ of academic medical centers in the US plus 65% of community oncologists. Revenue exceeded $530M in 2023.",
    profile: JSON.stringify({
      description:
        "Tempus is a precision medicine platform that combines clinical and molecular data to power AI-driven insights for oncology and other disease areas.",
      productSummary:
        "Tempus operates a multi-modal data platform that sequences DNA and RNA from cancer patients, integrates clinical records, imaging, and lab data, and applies AI to surface diagnostic and treatment insights. The company commercializes this through three channels: direct-to-physician oncology decision support, life sciences partnerships for drug discovery and trials, and data licensing to pharma.",
      targetCustomer:
        "Academic medical centers, community oncology practices, large pharmaceutical companies, and biotech research organizations. Buyers include CMOs, oncology medical directors, and pharma R&D leadership.",
      verticalTags: ["Precision Medicine", "Oncology AI", "Genomics", "Life Sciences AI", "Clinical Data Platform"],
      signalsExtracted: [
        { text: "IPO June 2024 at $6.1B valuation, raised $410M", source: "ai", sourceUrl: "https://www.businesswire.com/news/home/20240613047150/en/Tempus-AI-Announces-Pricing-of-Initial-Public-Offering" },
        { text: "Pre-IPO funding exceeded $1.3B including $200M Series G led by Google", source: "ai", sourceUrl: "https://www.businesswire.com/news/home/20240613047150/en/Tempus-AI-Announces-Pricing-of-Initial-Public-Offering" },
        { text: "Revenue $530M+ in 2023", source: "ai", sourceUrl: "https://www.businesswire.com/news/home/20240613047150/en/Tempus-AI-Announces-Pricing-of-Initial-Public-Offering" },
        { text: "Customers include 95% of US academic medical centers and 65% of community oncologists", source: "ai", sourceUrl: "https://www.businesswire.com/news/home/20240613047150/en/Tempus-AI-Announces-Pricing-of-Initial-Public-Offering" },
        { text: "Founded 2015 by Eric Lefkofsky (Groupon co-founder)", source: "ai", sourceUrl: "https://www.businesswire.com/news/home/20240613047150/en/Tempus-AI-Announces-Pricing-of-Initial-Public-Offering" },
        { text: "Multi-modal data spanning DNA/RNA sequencing, clinical records, imaging, and lab", source: "ai", sourceUrl: "https://www.businesswire.com/news/home/20240613047150/en/Tempus-AI-Announces-Pricing-of-Initial-Public-Offering" },
      ],
      stage: "Series H",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v1", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 3,
      recommendation: "PASS",
      rationale:
        "Tempus is the category leader in precision oncology AI and has demonstrated the playbook for clinical+molecular data businesses. They are also public, $6B+ valuation, and well outside our investment scope. Including them here as a reference for diligencing competitive landscape when we look at earlier-stage precision medicine and oncology AI companies. Useful for spotting future founders (former Tempus product, data, and ML talent are spinning out interesting companies in 2026).",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v3", fallback: false },
    }),
  },
  {
    name: "Inito",
    website: "https://www.inito.com",
    oneLiner: "Home-based hormone tracking platform for fertility and women's health using ML",
    vertical: "Life Sciences",
    stage: "Series B",
    status: "REVIEWING",
    sourceUrl: "https://techcrunch.com/2025/12/10/fertility-startup-inito-wants-to-use-ai-designed-antibodies-to-expand-at-home-health-tests",
    rawScrapedText:
      "Inito raised $29M Series B in December 2025 led by Bertelsmann India Investments and Fireside Ventures. Total funding $45M. Platform has analyzed 30M+ hormone data points since 2021. Expanding from fertility into broader at-home diagnostics using AI-engineered antibodies. Inito, a fertility and women's health technology company, has raised $30M in Series B funding led by Lightspeed Venture Partners with participation from Sequoia Capital India (Peak XV Partners), Endiya Partners, and Y Combinator. The company makes a smartphone-connected hormone testing device that measures four key fertility hormones (LH, E3G, PdG, FSH) from a single urine sample, with ML-based predictions of fertile windows, ovulation confirmation, and luteal phase health. Founded in 2018 by Aayush Rai (CEO) and Varun A.V. (CTO), both engineers from IIT. The company has shipped devices to 100,000+ users across 100+ countries and processed over 5 million hormone tests. Total funding now $50M including a $5M seed and $15M Series A. Inito recently launched a B2B partnership with Boston IVF to enable at-home cycle monitoring for IVF patients, reducing clinic visits by an estimated 40%.",
    profile: JSON.stringify({
      description:
        "Inito combines a smartphone-connected hormone testing device with machine learning to provide at-home fertility and women's health monitoring across the full reproductive cycle.",
      productSummary:
        "Inito's hardware reads four hormones (LH, E3G, PdG, FSH) from a single urine test cassette, transmits results to a smartphone app, and applies ML models to predict fertile windows, confirm ovulation, and track luteal phase health. Recent expansion into B2B partnerships allows IVF clinics to monitor patients remotely.",
      targetCustomer:
        "Direct-to-consumer initially: women actively trying to conceive, with secondary expansion into fertility clinics and IVF centers seeking remote patient monitoring capabilities.",
      verticalTags: ["Women's Health", "Fertility Tech", "FemTech", "Hormone Testing", "Reproductive Health"],
      signalsExtracted: [
        { text: "$29M Series B (December 2025) led by Bertelsmann India Investments, total funding $45M", source: "ai", sourceUrl: "https://techcrunch.com/2025/12/10/fertility-startup-inito-wants-to-use-ai-designed-antibodies-to-expand-at-home-health-tests" },
        { text: "30M+ hormone data points analyzed since 2021, 100,000+ shipped devices across 100+ countries", source: "ai", sourceUrl: "https://techcrunch.com/2025/12/10/fertility-startup-inito-wants-to-use-ai-designed-antibodies-to-expand-at-home-health-tests" },
        { text: "B2B partnership with Boston IVF reducing clinic visits by 40% for IVF cycle monitoring", source: "ai", sourceUrl: "https://techcrunch.com/2025/12/10/fertility-startup-inito-wants-to-use-ai-designed-antibodies-to-expand-at-home-health-tests" },
        { text: "Founders Aayush Rai (CEO) and Varun A.V. (CTO), both IIT engineers", source: "ai", sourceUrl: "https://techcrunch.com/2025/12/10/fertility-startup-inito-wants-to-use-ai-designed-antibodies-to-expand-at-home-health-tests" },
        { text: "Four-hormone single-cassette test is technically differentiated from single-hormone competitors", source: "ai", sourceUrl: "https://techcrunch.com/2025/12/10/fertility-startup-inito-wants-to-use-ai-designed-antibodies-to-expand-at-home-health-tests" },
        { text: "Expanding from fertility into broader at-home diagnostics using AI-engineered antibodies", source: "ai", sourceUrl: "https://techcrunch.com/2025/12/10/fertility-startup-inito-wants-to-use-ai-designed-antibodies-to-expand-at-home-health-tests" },
      ],
      stage: "Series B",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v1", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 7.5,
      recommendation: "REVIEWING",
      rationale:
        "Solid Vertical AI thesis fit with some open questions. The hormone-tracking + ML stack is technically differentiated (four hormones from one cassette is unusual), and the B2B pivot to IVF clinics is the right strategic move. $29M Series B at $45M total funding is squarely in our range. Open questions: how much of the ML actually drives value vs. the hardware/test capability, and how defensible the B2B distribution will be against existing IVF clinic software vendors. Worth a deeper conversation with the founders to understand the technical moat. Likely REVIEWING for now; could move to PRIORITY after diligence.",
      _meta: { model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", generatedAt: now, promptVersion: "v3", fallback: false },
    }),
  },
];

async function main() {
  console.log("Seeding database...");

  // Clean slate every run
  await prisma.note.deleteMany();
  await prisma.company.deleteMany();
  await prisma.scanRun.deleteMany();

  const created: { id: string; status: string }[] = [];

  for (const company of companies) {
    const c = await prisma.company.create({ data: company });
    created.push({ id: c.id, status: c.status });
    console.log(`  Created: ${c.name} (${c.status})`);
  }

  // A scan run so the queue page shows "Last scan: ..." instead of "No scans run yet"
  await prisma.scanRun.create({
    data: {
      query: "early-stage vertical AI healthcare fintech 2026",
      sourcesUsed: JSON.stringify(["seed"]),
      companyCount: companies.length,
    },
  });

  // Notes on two PRIORITY_FOLLOW_UP companies so detail pages have realistic content
  const priorities = created.filter((c) => c.status === "PRIORITY_FOLLOW_UP");
  if (priorities[0]) {
    await prisma.note.create({
      data: {
        companyId: priorities[0].id,
        body: "Intro from Sarah at Bessemer. Founder call scheduled for next Thursday. Strong technical bench.",
      },
    });
  }
  if (priorities[1]) {
    await prisma.note.create({
      data: {
        companyId: priorities[1].id,
        body: "Met founder at JPM Healthcare 2026. Following up after their next round to track follow-on opportunity.",
      },
    });
  }

  console.log(`Seeded ${companies.length} companies, 1 scan run, ${priorities.length >= 2 ? 2 : priorities.length} notes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
