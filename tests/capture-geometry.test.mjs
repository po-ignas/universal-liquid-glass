import assert from "node:assert/strict";
import test from "node:test";
import { planCaptureAnchorY, planRegionCapture, planVerticalOverscan, planViewportCapture } from "../dist/capture/captureGeometry.js";

test("capture anchor uses real document rows at the top and bottom boundaries", () => {
  assert.equal(planCaptureAnchorY({ scrollY: 0, documentHeight: 5000, sourceTop: 0, sourceHeight: 100, overscanY: 700 }), 700);
  assert.equal(planCaptureAnchorY({ scrollY: 4200, documentHeight: 5000, sourceTop: 0, sourceHeight: 100, overscanY: 700 }), 4200);
  assert.equal(planCaptureAnchorY({ scrollY: 2500, documentHeight: 5000, sourceTop: 0, sourceHeight: 100, overscanY: 700 }), 2500);
  assert.equal(planCaptureAnchorY({ scrollY: 0, documentHeight: 3300, sourceTop: 0, sourceHeight: 1000, overscanY: 1600 }), 700);
});

test("lens-local overscan spends the bounded pixel budget on source lifetime", () => {
  assert.equal(planVerticalOverscan({
    viewportHeight: 720,
    sourceWidth: 978,
    sourceHeight: 148,
    scale: 0.75,
    desiredViewportCount: 3.25,
    maxTextureSize: 4096,
    maxPixelCount: 6_291_456,
  }), 2340);
});

test("lens-local overscan remains bounded by texture height for a taller surface union", () => {
  assert.equal(planVerticalOverscan({
    viewportHeight: 720,
    sourceWidth: 978,
    sourceHeight: 569,
    scale: 0.75,
    desiredViewportCount: 3.5,
    maxTextureSize: 4096,
    maxPixelCount: 6_291_456,
  }), 2446);
});

test("lens-local capture translates viewport bounds into document crop coordinates", () => {
  assert.deepEqual(planRegionCapture({
    scrollX: 10, scrollY: 500, viewportWidth: 1200, viewportHeight: 800,
    left: 100, top: 20, width: 800, height: 100, overscanX: 12, overscanY: 80,
  }), {
    x: 98, y: 440, width: 824, height: 260,
    scrollX: 0, scrollY: 0, windowWidth: 1200, windowHeight: 800,
  });
});

test("source mapping accounts for a lens-local crop origin", () => {
  const mapping = mapBackdropSource({
    captureGeneration: 1, contentGeneration: 1, captureScrollX: 0, captureScrollY: 500,
    viewportWidth: 1200, viewportHeight: 800, overscanX: 12, overscanY: 80,
    sourceLeft: 100, sourceTop: 20, sourceWidth: 800, sourceHeight: 100,
  }, { contentGeneration: 1, scrollX: 0, scrollY: 500, viewportWidth: 1200, viewportHeight: 800 });
  assert.equal(mapping.offsetX, -88);
  assert.equal(mapping.offsetY, 60);
  assert.equal(mapping.sourceWidth, 824);
  assert.equal(mapping.sourceHeight, 260);
});
import { mapBackdropSource } from "../dist/performance/backdropSource.js";

test("overscan texture coordinates map back to the captured document viewport", () => {
  const geometry = planViewportCapture({
    scrollX: 0, scrollY: 500, viewportWidth: 390, viewportHeight: 844, overscanX: 0, overscanY: 2532,
  });
  assert.deepEqual(geometry, {
    x: 0, y: -2032, width: 390, height: 5908,
    scrollX: 0, scrollY: 0, windowWidth: 390, windowHeight: 844,
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
