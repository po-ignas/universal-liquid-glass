import assert from "node:assert/strict";
import test from "node:test";
import { CaptureScheduler } from "../dist/performance/captureScheduler.js";

test("continuous scrolling cannot start a DOM capture", () => {
  const scheduler = new CaptureScheduler();
  scheduler.queue("idle mutation");
  scheduler.beginScroll("scroll settled");

  for (let index = 0; index < 100; index += 1) {
    scheduler.beginScroll("scroll settled");
    assert.equal(scheduler.beginCapture(), null);
  }

  assert.equal(scheduler.snapshot.interactionMode, "scrolling");
  assert.equal(scheduler.snapshot.capturesThisScrollGesture, 0);
});

test("one coalesced capture starts after a scroll settles", () => {
  const scheduler = new CaptureScheduler();
  scheduler.beginScroll("scroll settled");
  scheduler.queue("DOM mutation");
  scheduler.beginScroll("scroll settled");
  scheduler.settle();

  assert.match(scheduler.beginCapture() ?? "", /scroll settled/);
  assert.equal(scheduler.snapshot.capturesThisScrollGesture, 1);
  assert.equal(scheduler.beginCapture(), null);
  scheduler.finishCapture();

  assert.deepEqual(scheduler.snapshot, {
    interactionMode: "idle",
    pendingCaptureReason: null,
    captureInFlight: false,
    capturesThisScrollGesture: 1,
  });
});

test("scrolling during an active capture queues only one settled refresh", () => {
  const scheduler = new CaptureScheduler();
  scheduler.queue("initial");
  assert.equal(scheduler.beginCapture(), "initial");

  for (let index = 0; index < 50; index += 1) scheduler.beginScroll("scroll settled");
  scheduler.finishCapture();
  assert.equal(scheduler.snapshot.interactionMode, "scrolling");
  assert.equal(scheduler.snapshot.capturesThisScrollGesture, 0);

  scheduler.settle();
  assert.equal(scheduler.beginCapture(), "scroll settled");
  assert.equal(scheduler.snapshot.capturesThisScrollGesture, 1);
  assert.equal(scheduler.beginCapture(), null);
});

test("continuous resize coalesces to one settled capture", () => {
  const scheduler = new CaptureScheduler();
  for (let index = 0; index < 50; index += 1) scheduler.beginResize();
  assert.equal(scheduler.beginCapture(), null);
  scheduler.settle();
  assert.equal(scheduler.beginCapture(), "resize settled");
  assert.equal(scheduler.beginCapture(), null);
});
