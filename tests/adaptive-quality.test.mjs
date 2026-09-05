import assert from "node:assert/strict";
import test from "node:test";
import { adaptQuality } from "../dist/performance/adaptiveQuality.js";

test("degrades quality when capture work is over budget", () => {
  assert.equal(adaptQuality("high", { averageFrameMs: 17, captureMs: 100 }), "medium");
  assert.equal(adaptQuality("medium", { averageFrameMs: 26, captureMs: 40 }), "low");
  assert.equal(adaptQuality("low", { averageFrameMs: 26, captureMs: 170 }), "fallback");
});

test("recovers one tier only when both measurements are comfortable", () => {
  assert.equal(adaptQuality("low", { averageFrameMs: 14, captureMs: 30 }), "medium");
  assert.equal(adaptQuality("medium", { averageFrameMs: 18, captureMs: 30 }), "medium");
  assert.equal(adaptQuality("fallback", { averageFrameMs: 10, captureMs: 10 }), "fallback");
});
