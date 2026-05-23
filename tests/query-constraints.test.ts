import test from "node:test";
import assert from "node:assert/strict";

import { extractConstraints, stripConstraintNoise } from "../src/lib/queryConstraints";

test("extractConstraints captures vertical, stage, geography, focus term, and time window", () => {
  const constraints = extractConstraints(
    "AI clinical NLP startup in USA raised Series A in the last 6 months"
  );

  assert.deepEqual(constraints.verticals, ["healthcare"]);
  assert.deepEqual(constraints.stages, ["Series A"]);
  assert.deepEqual(constraints.stageLabels, ["Series A"]);
  assert.deepEqual(constraints.geographies, ["United States"]);
  assert.deepEqual(constraints.focusTerms, ["clinical NLP"]);
  assert.equal(constraints.days, 180);
  assert.equal(constraints.timeLabel, "last 6 months");
});

test("extractConstraints maps fintech geography and recent phrasing", () => {
  const constraints = extractConstraints("recent AI underwriting startup in the UK");

  assert.deepEqual(constraints.verticals, ["fintech"]);
  assert.deepEqual(constraints.stageLabels, []);
  assert.deepEqual(constraints.geographies, ["United Kingdom"]);
  assert.deepEqual(constraints.focusTerms, ["insurance underwriting"]);
  assert.equal(constraints.days, 90);
  assert.equal(constraints.timeLabel, "recent (last 3 months)");
});

test("extractConstraints expands early stage into explicit enforceable stages", () => {
  const constraints = extractConstraints("early stage ai fintech startups");

  assert.deepEqual(constraints.verticals, ["fintech"]);
  assert.deepEqual(constraints.stageLabels, ["early stage"]);
  assert.deepEqual(constraints.stages, ["Pre-seed", "Seed", "Series A", "Series B"]);
});

test("extractConstraints does not double-count pre-seed as seed", () => {
  const constraints = extractConstraints("AI healthcare pre-seed startup");

  assert.deepEqual(constraints.verticals, ["healthcare"]);
  assert.deepEqual(constraints.stageLabels, ["Pre-seed"]);
  assert.deepEqual(constraints.stages, ["Pre-seed"]);
});

test("stripConstraintNoise removes dates and recency noise but keeps the search topic", () => {
  const cleaned = stripConstraintNoise("AI healthcare startup raised funding in 2026 over the last 6 months");
  assert.match(cleaned, /^AI healthcare startup raised funding in\b/);
  assert.doesNotMatch(cleaned, /\b2026\b/);
  assert.doesNotMatch(cleaned, /\blast 6 months\b/i);
});
