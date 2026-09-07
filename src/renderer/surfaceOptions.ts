import type { GlassSurfaceOptions } from "../types.js";

export const DEFAULT_SURFACE_OPTIONS: Required<GlassSurfaceOptions> = {
  borderRadius: 24,
  refraction: 1,
  thickness: 48,
  bevelWidth: 112,
  ior: 1.5,
  blur: 1.4,
  specular: 0.42,
  chromaticAberration: 0.08,
  tint: "#ffffff",
  tintOpacity: 0.055,
};

/** Preserve renderer defaults when React forwards an omitted prop as undefined. */
export function resolveSurfaceOptions(options: GlassSurfaceOptions = {}): Required<GlassSurfaceOptions> {
  return {
    borderRadius: options.borderRadius ?? DEFAULT_SURFACE_OPTIONS.borderRadius,
    refraction: options.refraction ?? DEFAULT_SURFACE_OPTIONS.refraction,
    thickness: options.thickness ?? DEFAULT_SURFACE_OPTIONS.thickness,
    bevelWidth: options.bevelWidth ?? DEFAULT_SURFACE_OPTIONS.bevelWidth,
    ior: options.ior ?? DEFAULT_SURFACE_OPTIONS.ior,
    blur: options.blur ?? DEFAULT_SURFACE_OPTIONS.blur,
    specular: options.specular ?? DEFAULT_SURFACE_OPTIONS.specular,
    chromaticAberration: options.chromaticAberration ?? DEFAULT_SURFACE_OPTIONS.chromaticAberration,
    tint: options.tint ?? DEFAULT_SURFACE_OPTIONS.tint,
    tintOpacity: options.tintOpacity ?? DEFAULT_SURFACE_OPTIONS.tintOpacity,
  };
}
