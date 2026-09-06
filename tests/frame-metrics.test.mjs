import assert from "node:assert/strict";
import test from "node:test";
import { summarizeFrameTimes } from "../dist/performance/frameMetrics.js";

test("long interaction stalls remain in frame metrics", () => {
  const summary = summarizeFrameTimes([
    ...Array.from({ length: 18 }, () => 16),
    90,
    140,
  ]);

  assert.equal(summary.p95FrameMs, 90);
  assert.equal(summary.worstFrameMs, 140);
  assert.equal(summary.averageFrameMs, 25.9);
  assert.equal(Math.round(summary.fps), 39);
});
