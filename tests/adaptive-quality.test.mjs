import assert from "node:assert/strict";
import test from "node:test";
import { adaptQuality } from "../dist/performance/adaptiveQuality.js";

test("degrades shader quality from measured frame pressure", () => {
  assert.equal(adaptQuality("high", { averageFrameMs: 17, p95FrameMs: 55, captureMs: 20 }), "medium");
  assert.equal(adaptQuality("medium", { averageFrameMs: 26, p95FrameMs: 30, captureMs: 20 }), "low");
  assert.equal(adaptQuality("low", { averageFrameMs: 26, p95FrameMs: 50, captureMs: 20 }), "fallback");
});

test("slow DOM capture changes capture policy rather than shader fidelity", () => {
  assert.equal(adaptQuality("high", { averageFrameMs: 16, p95FrameMs: 18, captureMs: 120 }), "high");
  assert.equal(adaptQuality("low", { averageFrameMs: 16, p95FrameMs: 18, captureMs: 170 }), "low");
});

test("recovers one tier only when both measurements are comfortable", () => {
  assert.equal(adaptQuality("low", { averageFrameMs: 14, captureMs: 30 }), "medium");
  assert.equal(adaptQuality("medium", { averageFrameMs: 18, captureMs: 30 }), "medium");
  assert.equal(adaptQuality("fallback", { averageFrameMs: 10, captureMs: 10 }), "fallback");
});
