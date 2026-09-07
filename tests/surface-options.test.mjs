import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SURFACE_OPTIONS, resolveSurfaceOptions } from "../dist/renderer/surfaceOptions.js";

test("omitted React props do not overwrite optical defaults with undefined", () => {
  const resolved = resolveSurfaceOptions({
    borderRadius: 26,
    refraction: undefined,
    thickness: undefined,
    bevelWidth: undefined,
    ior: undefined,
    blur: undefined,
    specular: undefined,
    chromaticAberration: undefined,
    tint: undefined,
    tintOpacity: undefined,
    flushEdges: undefined,
  });

  assert.deepEqual(resolved, { ...DEFAULT_SURFACE_OPTIONS, borderRadius: 26 });
  for (const value of [resolved.refraction, resolved.thickness, resolved.bevelWidth, resolved.ior, resolved.blur, resolved.specular, resolved.chromaticAberration, resolved.tintOpacity]) {
    assert.equal(Number.isFinite(value), true);
  }
});

test("flush edge treatment defaults to auto and preserves explicit masks", () => {
  assert.equal(resolveSurfaceOptions().flushEdges, "auto");
  assert.deepEqual(resolveSurfaceOptions({ flushEdges: { top: true, left: true } }).flushEdges, { top: true, left: true });
  assert.equal(resolveSurfaceOptions({ flushEdges: false }).flushEdges, false);
});

test("explicit optical settings still override defaults", () => {
  assert.deepEqual(resolveSurfaceOptions({ refraction: 1.5, blur: 0, tintOpacity: 0 }), {
    ...DEFAULT_SURFACE_OPTIONS,
    refraction: 1.5,
    blur: 0,
    tintOpacity: 0,
  });
});
