import assert from "node:assert/strict";
import test from "node:test";
import { calculateConceptualClearHeight } from "../app/lib/bim-coordination.ts";

test("stacked section strategy subtracts beam and MEP zones separately", () => {
  const result = calculateConceptualClearHeight(3.4, 0.3, 0.45, 0.12, 0.08, "stacked");
  assert.equal(Number(result.occupiedCeilingZone.toFixed(2)), 0.75);
  assert.equal(Number(result.clearHeight.toFixed(2)), 2.45);
});

test("integrated section strategy uses the governing shared ceiling zone", () => {
  const result = calculateConceptualClearHeight(3.4, 0.3, 0.45, 0.12, 0.08, "integrated");
  assert.equal(Number(result.occupiedCeilingZone.toFixed(2)), 0.45);
  assert.equal(Number(result.clearHeight.toFixed(2)), 2.75);
});
