import test from "node:test";
import assert from "node:assert/strict";

import { COMPANY_ANALYSIS_PROMPT, THESIS_FIT_PROMPT } from "../src/lib/prompts";

test("thesis prompt enforces the early-stage mandate gate", () => {
  assert.equal(THESIS_FIT_PROMPT.version, "v3");
  assert.match(THESIS_FIT_PROMPT.system, /core entry window is Pre-seed through Series B/i);
  assert.match(THESIS_FIT_PROMPT.system, /Series C or later.*cap the score at 4/i);
  assert.match(THESIS_FIT_PROMPT.system, /recommendation MUST be PASS/i);
});

test("combined analysis prompt stays aligned with the standalone thesis rubric", () => {
  assert.equal(COMPANY_ANALYSIS_PROMPT.version, "v2");
  assert.match(COMPANY_ANALYSIS_PROMPT.system, /core entry window is Pre-seed through Series B/i);
  assert.match(COMPANY_ANALYSIS_PROMPT.system, /Series C or later.*cap the score at 4/i);
  assert.match(COMPANY_ANALYSIS_PROMPT.system, /Score for fund fit, not company quality/i);
});
