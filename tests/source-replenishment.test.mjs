import assert from "node:assert/strict";
import test from "node:test";
import { activeReplenishmentLimit, decideSourceReplenishment, directionalOverscanRemaining, replenishmentThreshold } from "../dist/performance/sourceReplenishment.js";

test("remaining overscan follows the live scroll direction", () => {
  assert.equal(directionalOverscanRemaining(1000, -800, 2), 1800);
  assert.equal(directionalOverscanRemaining(1000, 800, -2), 1800);
  assert.equal(directionalOverscanRemaining(1000, 800, 2), 200);
  assert.equal(directionalOverscanRemaining(1000, -800, -2), 200);
});

const base = {
  sourceState: "scroll-compensated",
  sourceReady: true,
  captureInFlight: false,
  capturesThisScrollGesture: 0,
  captureMs: 110,
  scrollVelocityY: 3,
  remainingY: 1200,
  overscanY: 2340,
  viewportHeight: 720,
};

test("replenishment starts early enough for measured scroll velocity and capture time", () => {
  assert.equal(replenishmentThreshold(base), 648);
  assert.equal(decideSourceReplenishment({ ...base, remainingY: 649 }), "none");
  assert.equal(decideSourceReplenishment({ ...base, remainingY: 648 }), "capture");
});

test("fast captures can replenish repeatedly before requesting settled recovery", () => {
  assert.equal(activeReplenishmentLimit(110), 4);
  assert.equal(decideSourceReplenishment({ ...base, remainingY: 300, capturesThisScrollGesture: 1 }), "capture");
  assert.equal(decideSourceReplenishment({ ...base, remainingY: 100, capturesThisScrollGesture: 4 }), "recover");
  assert.equal(decideSourceReplenishment({ ...base, remainingY: 100, captureInFlight: true }), "none");
});

test("slow capture paths wait for a settled recovery rather than capturing during scroll", () => {
  assert.equal(activeReplenishmentLimit(900), 0);
  assert.equal(decideSourceReplenishment({ ...base, remainingY: 300, captureMs: 900 }), "none");
  assert.equal(decideSourceReplenishment({ ...base, remainingY: 100, captureMs: 900 }), "recover");
});

test("an invalid source requests recovery while exact sources do not capture speculatively", () => {
  assert.equal(decideSourceReplenishment({ ...base, remainingY: 0, sourceState: "invalid" }), "recover");
  assert.equal(decideSourceReplenishment({ ...base, remainingY: 0, sourceState: "exact" }), "none");
});
