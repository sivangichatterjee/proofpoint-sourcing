import test from "node:test";
import assert from "node:assert/strict";

import { COMPANY_ANALYSIS_PROMPT, THESIS_FIT_PROMPT } from "../src/lib/prompts";
import {
  getAlternativeComparisonModels,
  getAnalystGuidanceFromThesisFitJson,
} from "../src/lib/thesis";

test("thesis prompt enforces the early-stage mandate gate", () => {
  assert.equal(THESIS_FIT_PROMPT.version, "v5");
  assert.match(THESIS_FIT_PROMPT.system, /core entry window is Pre-seed through Series B/i);
  assert.match(THESIS_FIT_PROMPT.system, /Series C or later.*cap the score at 4/i);
  assert.match(THESIS_FIT_PROMPT.system, /recommendation MUST be PASS/i);
});

test("thesis prompt can incorporate reviewer-corrected profile fields", () => {
  const userPrompt = THESIS_FIT_PROMPT.buildUser({
    profileJson: "{\"description\":\"Original\"}",
    reviewerProfileEdits: {
      description: "CEO left with the money",
      stage: "Series C",
    },
  });

  assert.match(userPrompt, /REVIEWER-CORRECTED PROFILE FIELDS:/);
  assert.match(userPrompt, /CEO left with the money/);
  assert.match(userPrompt, /Treat these corrections as higher-confidence/i);
});

test("thesis prompt can make incorporated reviewer edits authoritative", () => {
  const userPrompt = THESIS_FIT_PROMPT.buildUser({
    profileJson: "{\"description\":\"Original\"}",
    humanEditedRationale: "Very good company to invest in despite stage.",
    reviewerOverrideMode: "authoritative",
  });

  assert.match(userPrompt, /REGENERATION MODE:/);
  assert.match(userPrompt, /primary working truth for this regeneration run/i);
  assert.match(userPrompt, /MUST move materially upward/i);
  assert.match(userPrompt, /do not let the default mandate gate silently dominate/i);
});

test("combined analysis prompt stays aligned with the standalone thesis rubric", () => {
  assert.equal(COMPANY_ANALYSIS_PROMPT.version, "v2");
  assert.match(COMPANY_ANALYSIS_PROMPT.system, /core entry window is Pre-seed through Series B/i);
  assert.match(COMPANY_ANALYSIS_PROMPT.system, /Series C or later.*cap the score at 4/i);
  assert.match(COMPANY_ANALYSIS_PROMPT.system, /Score for fund fit, not company quality/i);
});

test("saved thesis guidance can be reused by the comparison model", () => {
  const analystGuidance = getAnalystGuidanceFromThesisFitJson(
    JSON.stringify({
      score: 6,
      recommendation: "REVIEWING",
      rationale: "Needs more diligence.",
      _meta: {
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        generatedAt: "2026-05-24T00:00:00.000Z",
        promptVersion: "v5",
        fallback: false,
        analystGuidance: "be stricter about stage and fund fit",
      },
    })
  );

  assert.equal(analystGuidance, "be stricter about stage and fund fit");

  const userPrompt = THESIS_FIT_PROMPT.buildUser({
    profileJson: "{\"description\":\"Original\"}",
    analystGuidance,
  });

  assert.match(userPrompt, /ANALYST DIRECTION:/);
  assert.match(userPrompt, /be stricter about stage and fund fit/);
});

test("comparison route chooses the other model as the alternative", () => {
  assert.deepEqual(
    getAlternativeComparisonModels("meta-llama/Llama-3.3-70B-Instruct-Turbo").map(
      (model) => model.id
    ),
    ["gpt-4o-mini"]
  );

  assert.deepEqual(
    getAlternativeComparisonModels("gpt-4o-mini").map((model) => model.id),
    ["meta-llama/Llama-3.3-70B-Instruct-Turbo"]
  );
});
