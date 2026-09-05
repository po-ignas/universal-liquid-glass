export type GlassQuality = "high" | "medium" | "low" | "fallback";

export interface GlassQualityConfig {
  captureScale: number;
  minCaptureIntervalMs: number;
  enableChromaticAberration: boolean;
  blurSamples: number;
}

export interface GlassSurfaceOptions {
  borderRadius?: number;
  refraction?: number;
  blur?: number;
  chromaticAberration?: number;
}
