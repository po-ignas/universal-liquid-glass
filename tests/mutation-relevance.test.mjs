import assert from "node:assert/strict";
import test from "node:test";
import { rectCanAffectSurface } from "../dist/performance/mutationRelevance.js";

const header = { left: 0, top: 0, right: 390, bottom: 58, width: 390, height: 58 };
const footer = { left: 326, top: 372, right: 382, bottom: 756, width: 56, height: 384 };

test("off-surface dynamic DOM does not invalidate fixed glass", () => {
  const faq = { left: 16, top: 180, right: 300, bottom: 240, width: 284, height: 60 };
  assert.equal(rectCanAffectSurface(faq, [header, footer], 12), false);
});

test("mutations under a surface or its sampling margin remain relevant", () => {
  const underHeader = { left: 20, top: 30, right: 120, bottom: 70, width: 100, height: 40 };
  const nearFooter = { left: 300, top: 400, right: 320, bottom: 440, width: 20, height: 40 };
  assert.equal(rectCanAffectSurface(underHeader, [header, footer], 0), true);
  assert.equal(rectCanAffectSurface(nearFooter, [header, footer], 12), true);
});

test("ambiguous zero-area mutation targets stay conservative", () => {
  const collapsed = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  assert.equal(rectCanAffectSurface(collapsed, [header, footer]), true);
});
