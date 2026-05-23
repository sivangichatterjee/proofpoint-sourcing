import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCompanyName } from "../src/lib/companyDedupe";
import { detectStage } from "../src/lib/stage";

test("detectStage identifies explicit funding stages", () => {
  assert.equal(detectStage("The company raised a Series B round last month."), "Series B");
  assert.equal(detectStage("It emerged from stealth with a seed round."), "Seed");
  assert.equal(detectStage("The startup is currently operating in stealth mode."), "Stealth");
});

test("detectStage does not incorrectly mark exited stealth companies as stealth", () => {
  assert.equal(detectStage("The company launched out of stealth after raising seed funding."), "Seed");
  assert.equal(detectStage("The startup emerged from stealth this week."), null);
});

test("normalizeCompanyName collapses common company suffixes and healthcare/AI variants", () => {
  assert.equal(normalizeCompanyName("Inbox Health, Inc."), "inbox");
  assert.equal(normalizeCompanyName("Third Way Health AI"), "third way");
  assert.equal(normalizeCompanyName("AIDOC Healthcare Technologies LLC"), "aidoc");
});
