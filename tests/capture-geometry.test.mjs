import assert from "node:assert/strict";
import test from "node:test";
import { planViewportCapture } from "../dist/capture/captureGeometry.js";
import { mapBackdropSource } from "../dist/performance/backdropSource.js";

test("overscan texture coordinates map back to the captured document viewport", () => {
  const geometry = planViewportCapture({
    scrollX: 0, scrollY: 500, viewportWidth: 390, viewportHeight: 844, overscanX: 0, overscanY: 2532,
  });
  assert.deepEqual(geometry, {
    x: 0, y: -2032, width: 390, height: 5908,
    scrollX: 0, scrollY: 500, windowWidth: 390, windowHeight: 844,
  });

  const mapping = mapBackdropSource({
    captureGeneration: 1, contentGeneration: 1,
    captureScrollX: 0, captureScrollY: 500,
    viewportWidth: 390, viewportHeight: 844,
    overscanX: 0, overscanY: 2532,
  }, {
    contentGeneration: 1, scrollX: 0, scrollY: 500,
    viewportWidth: 390, viewportHeight: 844,
  });
  assert.equal(geometry.y + mapping.offsetY, 500);
});

test("live scroll compensation selects the new document position", () => {
  const geometry = planViewportCapture({
    scrollX: 0, scrollY: 500, viewportWidth: 390, viewportHeight: 844, overscanX: 0, overscanY: 2532,
  });
  const mapping = mapBackdropSource({
    captureGeneration: 1, contentGeneration: 1,
    captureScrollX: 0, captureScrollY: 500,
    viewportWidth: 390, viewportHeight: 844,
    overscanX: 0, overscanY: 2532,
  }, {
    contentGeneration: 1, scrollX: 0, scrollY: 900,
    viewportWidth: 390, viewportHeight: 844,
  });
  assert.equal(geometry.y + mapping.offsetY, 900);
});
