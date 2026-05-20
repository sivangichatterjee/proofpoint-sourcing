import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const now = new Date().toISOString();

const companies = [
  {
    name: "CerePath AI",
    website: "https://cerepath.ai",
    oneLiner: "AI co-pilot for radiologists that cuts read time by 40%",
    vertical: "Healthcare",
    stage: "Series A",
    status: "PRIORITY",
    profile: JSON.stringify({
      description:
        "CerePath AI builds real-time decision support for diagnostic radiology, surfacing critical findings and automating routine reads across CT, MRI, and X-ray modalities.",
      productSummary:
        "An AI-native worklist manager and triage engine that prioritizes studies by acuity, pre-annotates findings, and drafts structured reports for radiologist review.",
      targetCustomer:
        "Regional health systems and radiology groups (10–200 radiologists) seeking to expand reading capacity without adding headcount.",
      verticalTags: ["Radiology", "Clinical Workflow", "Diagnostic AI"],
      signalsExtracted: [
        "Former GE Healthcare and Mayo Clinic founders",
        "Pilot live at 3 health systems",
        "FDA 510(k) clearance in progress",
        "80% reduction in critical-finding notification time in pilot",
      ],
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 8,
      recommendation: "PRIORITY",
      rationale:
        "Strong vertical focus in radiology, credentialed domain founders, active pilots with a clear buyer (radiology department head). Proprietary model fine-tuned on de-identified DICOM data creates a data moat. Stage and check size fit our Series A mandate.",
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
  },
  {
    name: "PharmaTrace",
    website: "https://pharmatrace.io",
    oneLiner: "AI-powered pharmacovigilance platform for global drug safety teams",
    vertical: "Life Sciences",
    stage: "Seed",
    status: "REVIEWING",
    profile: JSON.stringify({
      description:
        "PharmaTrace automates adverse event detection and regulatory report generation for pharmaceutical manufacturers, reducing manual case processing from days to minutes.",
      productSummary:
        "An LLM-driven case intake and triage system that parses unstructured reports, codes MedDRA terms, and auto-generates ICSRs for EMA/FDA submission.",
      targetCustomer:
        "Mid-size pharma companies (Phase III and beyond) and CROs handling pharmacovigilance outsourcing.",
      verticalTags: ["Pharmacovigilance", "Regulatory AI", "Life Sciences"],
      signalsExtracted: [
        "CEO previously built PV workflows at Pfizer",
        "Two design partners signed LOIs",
        "Processing 500+ cases/month in beta",
        "Integration with Argus and Veeva Vault",
      ],
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 7,
      recommendation: "REVIEWING",
      rationale:
        "Clear vertical (pharmacovigilance) with identifiable buyer and regulatory urgency driving adoption. Founders have domain credibility. Early traction is real but customer concentration risk—two design partners is thin for Seed conviction. Want to see one paying contract before moving to PRIORITY.",
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
  },
  {
    name: "ClaimSight",
    website: "https://claimsight.com",
    oneLiner: "Automated prior authorization and claims adjudication for health insurers",
    vertical: "Healthcare",
    stage: "Series A",
    status: "REVIEWING",
    profile: JSON.stringify({
      description:
        "ClaimSight uses AI to automate the prior authorization workflow and downstream claims adjudication for commercial and Medicare Advantage health plans.",
      productSummary:
        "A rules engine augmented with an LLM layer that interprets clinical notes, applies payer-specific criteria, and delivers instant PA decisions with an auditable rationale trail.",
      targetCustomer:
        "Regional and national payers processing >500K claims/year; also targeting provider-facing RCM companies.",
      verticalTags: ["Health Insurance", "Prior Authorization", "RCM"],
      signalsExtracted: [
        "Pilot with Blue Cross affiliate (undisclosed)",
        "CMS mandate for PA transparency creates regulatory tailwind",
        "Former Anthem and Optum product leaders on team",
        "95% auto-adjudication rate in pilot",
      ],
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 7,
      recommendation: "REVIEWING",
      rationale:
        "Favorable regulatory tailwind (CMS PA rules) and large TAM. Team pedigree is strong. Concern is enterprise sales cycle length and switching costs from incumbent vendors. Need deeper diligence on contract structure and payer willingness to share clinical data.",
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
  },
  {
    name: "LendLogic",
    website: "https://lendlogic.ai",
    oneLiner: "AI underwriting engine for community banks and credit unions",
    vertical: "Fintech",
    stage: "Series A",
    status: "PRIORITY",
    profile: JSON.stringify({
      description:
        "LendLogic replaces spreadsheet-based credit analysis with an AI underwriting platform tailored to SMB and commercial real estate loans at community financial institutions.",
      productSummary:
        "An end-to-end loan origination and underwriting tool that ingests tax returns, financials, and property data to generate credit memos and risk ratings in under 10 minutes.",
      targetCustomer:
        "US community banks ($500M–$5B assets) and credit unions doing SMB and CRE lending.",
      verticalTags: ["Community Banking", "SMB Lending", "Credit Underwriting"],
      signalsExtracted: [
        "12 community bank customers, $8M ARR",
        "CEO is former community bank EVP",
        "Average time-to-decision reduced from 3 weeks to 4 days",
        "Core integrations with Fiserv and Jack Henry",
      ],
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 9,
      recommendation: "PRIORITY",
      rationale:
        "Exceptional thesis fit: vertical AI for an underserved, sticky customer base (community banks) with a credible founder, proven revenue, and deep workflow integration. Core system integrations create lock-in. This is the archetype of the deal we want to lead.",
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
  },
  {
    name: "GenomixFlow",
    website: "https://genomixflow.com",
    oneLiner: "Workflow automation for genomics labs doing variant interpretation at scale",
    vertical: "Life Sciences",
    stage: "Seed",
    status: "NEW",
    profile: JSON.stringify({
      description:
        "GenomixFlow accelerates clinical genomics interpretation by automating variant curation, literature triage, and report generation for diagnostic labs.",
      productSummary:
        "An AI pipeline that classifies variants against ClinVar, OMIM, and internal databases, surfaces supporting evidence, and drafts clinical-grade pathology reports.",
      targetCustomer:
        "Clinical genomics labs at academic medical centers and regional hospital systems.",
      verticalTags: ["Genomics", "Diagnostic Labs", "Bioinformatics"],
      signalsExtracted: [
        "Pilot underway at a large academic genomics lab (unnamed)",
        "Founders are PhD computational biologists with prior startup exits",
        "3x faster variant interpretation vs. manual workflow in internal benchmarks",
      ],
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 6,
      recommendation: "NEW",
      rationale:
        "Promising vertical with real pain—genomics labs are drowning in variants and short on genetic counselors. Technical founders with credible backgrounds. Too early to assess PMF; single pilot, no revenue. Needs follow-up in Q3 when pilot data is available.",
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
  },
  {
    name: "InsureFlow AI",
    website: "https://insureflow.ai",
    oneLiner: "AI-native claims processing and fraud detection for P&C insurers",
    vertical: "Fintech",
    stage: "Series B",
    status: "PASS",
    profile: JSON.stringify({
      description:
        "InsureFlow AI offers a suite of AI models for property and casualty insurers covering FNOL automation, claims triage, fraud scoring, and subrogation opportunity identification.",
      productSummary:
        "A modular AI platform deployed as a claims intelligence layer over existing core systems (Guidewire, Duck Creek), with models for each stage of the claims lifecycle.",
      targetCustomer:
        "Tier 1 and Tier 2 P&C carriers with >$1B in written premium.",
      verticalTags: ["Insurance", "Claims Processing", "Fraud Detection"],
      signalsExtracted: [
        "Series B at $85M post-money, led by Tier 1 growth fund",
        "Customers include two Top 10 US carriers",
        "Implied $15M+ ARR",
        "Product expanding horizontally across insurance lines",
      ],
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
    }),
    thesisFit: JSON.stringify({
      score: 4,
      recommendation: "PASS",
      rationale:
        "Strong company but wrong stage and valuation for our mandate. Series B with a growth-stage lead means high entry price and limited ownership. The product is expanding horizontally across insurance lines, diluting the vertical focus we look for. Pass for now.",
      _meta: { model: "seed", generatedAt: now, promptVersion: "v0", fallback: false },
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

  // Notes on two PRIORITY companies so detail pages have realistic content
  const priorities = created.filter((c) => c.status === "PRIORITY");
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