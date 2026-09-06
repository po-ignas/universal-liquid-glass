import assert from "node:assert/strict";
import test from "node:test";
import { CaptureScheduler } from "../dist/performance/captureScheduler.js";
import { canPresentFreshWebgl, TextureFreshness } from "../dist/performance/textureFreshness.js";

test("a texture is fresh only after a current-generation upload and draw", () => {
  const freshness = new TextureFreshness();
  assert.equal(freshness.snapshot.textureFresh, false);

  freshness.invalidate();
  const generation = freshness.beginCapture();
  assert.equal(freshness.markTextureUploaded(generation), true);
  assert.equal(freshness.snapshot.textureFresh, false);
  assert.equal(freshness.markDrawn(generation), true);
  freshness.finishCapture(generation);

  assert.deepEqual(freshness.snapshot, {
    viewportGeneration: 1,
    textureGeneration: 1,
    captureGeneration: null,
    drawnGeneration: 1,
    textureFresh: true,
  });
});

test("a capture made obsolete by scrolling cannot become fresh", () => {
  const freshness = new TextureFreshness();
  freshness.invalidate();
  const obsoleteGeneration = freshness.beginCapture();

  freshness.invalidate();
  assert.equal(freshness.markTextureUploaded(obsoleteGeneration), false);
  assert.equal(freshness.markDrawn(obsoleteGeneration), false);
  freshness.finishCapture(obsoleteGeneration);
  assert.equal(freshness.snapshot.textureFresh, false);

  const currentGeneration = freshness.beginCapture();
  assert.equal(freshness.markTextureUploaded(currentGeneration), true);
  assert.equal(freshness.markDrawn(currentGeneration), true);
  freshness.finishCapture(currentGeneration);
  assert.equal(freshness.snapshot.textureFresh, true);
  assert.equal(freshness.snapshot.textureGeneration, freshness.snapshot.viewportGeneration);
});

test("a DOM mutation during capture makes that result obsolete", () => {
  const freshness = new TextureFreshness();
  const captureGeneration = freshness.beginCapture();
  freshness.invalidate();

  assert.equal(freshness.isCaptureCurrent(captureGeneration), false);
  assert.equal(freshness.markTextureUploaded(captureGeneration), false);
  freshness.finishCapture(captureGeneration);
  assert.deepEqual(freshness.snapshot, {
    viewportGeneration: 1,
    textureGeneration: -1,
    captureGeneration: null,
    drawnGeneration: -1,
    textureFresh: false,
  });
});

test("WebGL visibility requires a fully idle, drawn, current texture", () => {
  const base = {
    rendererAvailable: true,
    interactionMode: "idle",
    captureInFlight: false,
    pendingCaptureReason: null,
    textureFresh: true,
    layoutDirty: false,
  };

  assert.equal(canPresentFreshWebgl(base), true);
  assert.equal(canPresentFreshWebgl({ ...base, interactionMode: "settling" }), false);
  assert.equal(canPresentFreshWebgl({ ...base, interactionMode: "refreshing", captureInFlight: true }), false);
  assert.equal(canPresentFreshWebgl({ ...base, pendingCaptureReason: "DOM mutation" }), false);
  assert.equal(canPresentFreshWebgl({ ...base, textureFresh: false }), false);
  assert.equal(canPresentFreshWebgl({ ...base, layoutDirty: true }), false);
  assert.equal(canPresentFreshWebgl({ ...base, rendererAvailable: false }), false);
});

test("resume-during-capture discards the first result and refreshes once after final settle", () => {
  const scheduler = new CaptureScheduler();
  const freshness = new TextureFreshness();
  scheduler.queue("first settle");
  assert.equal(scheduler.beginCapture(), "first settle");
  const obsoleteGeneration = freshness.beginCapture();

  freshness.invalidate();
  scheduler.beginScroll("second settle");
  assert.equal(scheduler.beginCapture(), null);
  assert.equal(freshness.markTextureUploaded(obsoleteGeneration), false);
  freshness.finishCapture(obsoleteGeneration);
  scheduler.finishCapture();
  assert.equal(scheduler.snapshot.capturesThisScrollGesture, 0);

  scheduler.settle();
  assert.equal(scheduler.beginCapture(), "second settle");
  const currentGeneration = freshness.beginCapture();
  assert.equal(freshness.markTextureUploaded(currentGeneration), true);
  assert.equal(freshness.markDrawn(currentGeneration), true);
  freshness.finishCapture(currentGeneration);
  scheduler.finishCapture();

  assert.equal(scheduler.snapshot.capturesThisScrollGesture, 1);
  assert.equal(freshness.snapshot.textureFresh, true);
  assert.equal(freshness.snapshot.textureGeneration, freshness.snapshot.viewportGeneration);
});
