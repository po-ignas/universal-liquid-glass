import type { GlassSurfaceOptions } from "../types.js";

export const DEFAULT_SURFACE_OPTIONS: Required<GlassSurfaceOptions> = {
  borderRadius: 24,
  refraction: 1,
  blur: 3.2,
  chromaticAberration: 0.32,
  tint: "#ffffff",
  tintOpacity: 0.065,
};

/** Preserve renderer defaults when React forwards an omitted prop as undefined. */
export function resolveSurfaceOptions(options: GlassSurfaceOptions = {}): Required<GlassSurfaceOptions> {
  return {
    borderRadius: options.borderRadius ?? DEFAULT_SURFACE_OPTIONS.borderRadius,
    refraction: options.refraction ?? DEFAULT_SURFACE_OPTIONS.refraction,
    blur: options.blur ?? DEFAULT_SURFACE_OPTIONS.blur,
    chromaticAberration: options.chromaticAberration ?? DEFAULT_SURFACE_OPTIONS.chromaticAberration,
    tint: options.tint ?? DEFAULT_SURFACE_OPTIONS.tint,
    tintOpacity: options.tintOpacity ?? DEFAULT_SURFACE_OPTIONS.tintOpacity,
  };
}
