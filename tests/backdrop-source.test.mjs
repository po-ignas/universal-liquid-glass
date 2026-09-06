import assert from "node:assert/strict";
import test from "node:test";
import { mapBackdropSource } from "../dist/performance/backdropSource.js";

const source = {
  captureGeneration: 7,
  contentGeneration: 3,
  captureScrollX: 0,
  captureScrollY: 1000,
  viewportWidth: 400,
  viewportHeight: 800,
  overscanX: 0,
  overscanY: 1600,
};

test("a source is exact only at its captured scroll origin", () => {
  const mapping = mapBackdropSource(source, {
    contentGeneration: 3, scrollX: 0, scrollY: 1000, viewportWidth: 400, viewportHeight: 800,
  });
  assert.equal(mapping.state, "exact");
  assert.equal(mapping.offsetY, 1600);
  assert.equal(mapping.remainingY, 1600);
});

test("known scroll translation remains valid inside overscan", () => {
  const mapping = mapBackdropSource(source, {
    contentGeneration: 3, scrollX: 0, scrollY: 2250, viewportWidth: 400, viewportHeight: 800,
  });
  assert.equal(mapping.state, "scroll-compensated");
  assert.equal(mapping.deltaY, 1250);
  assert.equal(mapping.offsetY, 2850);
  assert.equal(mapping.remainingY, 350);
});

test("overscan exhaustion, resize, horizontal movement, and content changes are invalid", () => {
  const base = { contentGeneration: 3, scrollX: 0, scrollY: 1000, viewportWidth: 400, viewportHeight: 800 };
  assert.equal(mapBackdropSource(source, { ...base, scrollY: 2601 }).state, "invalid");
  assert.equal(mapBackdropSource(source, { ...base, viewportHeight: 801 }).state, "invalid");
  assert.equal(mapBackdropSource(source, { ...base, scrollX: 1 }).state, "invalid");
  assert.equal(mapBackdropSource(source, { ...base, contentGeneration: 4 }).state, "invalid");
});
