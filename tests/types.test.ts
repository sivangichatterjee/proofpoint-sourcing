import test from "node:test";
import assert from "node:assert/strict";

import { prepareSignalsForSave } from "../src/lib/types";

test("prepareSignalsForSave preserves AI provenance while keeping analyst additions", () => {
  const saved = prepareSignalsForSave(
    [
      {
        text: "  $16 million Series A funding  ",
        source: "ai",
        sourceUrl: "https://example.com/source ",
      },
      {
        text: " analyst added note ",
        source: "analyst",
      },
      {
        text: "   ",
        source: "analyst",
      },
    ],
    () => "2026-05-24T12:00:00.000Z"
  );

  assert.deepEqual(saved, [
    {
      text: "$16 million Series A funding",
      source: "ai",
      sourceUrl: "https://example.com/source",
    },
    {
      text: "analyst added note",
      source: "analyst",
      sourceUrl: undefined,
      addedAt: "2026-05-24T12:00:00.000Z",
    },
  ]);
});
