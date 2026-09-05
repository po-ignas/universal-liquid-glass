import type { CSSProperties, ReactNode } from "react";

export type GlassQuality = "high" | "medium" | "low" | "fallback";

export interface GlassQualityConfig {
  captureScale: number;
  minCaptureIntervalMs: number;
  blurSamples: 5 | 9 | 13;
  chromaticAberration: boolean;
  maxDpr: number;
}

export interface GlassSurfaceOptions {
  /** Rounded corner radius in CSS pixels. Defaults to the computed CSS radius. */
  borderRadius?: number;
  /** Edge lens strength. 1 is the tuned navigation-surface default. */
  refraction?: number;
  /** Frost/scattering radius in CSS pixels. */
  blur?: number;
  /** RGB separation at the refractive edge, from 0 to 1. */
  chromaticAberration?: number;
  /** CSS tint color. */
  tint?: string;
  /** Tint mix, from 0 to 1. */
  tintOpacity?: number;
}

export interface GlassMetrics {
  mode: "webgl2" | "fallback";
  quality: GlassQuality;
  averageFrameMs: number;
  fps: number;
  captureMs: number;
  captureScale: number;
  captureCount: number;
  surfaceCount: number;
  textureWidth: number;
  textureHeight: number;
}

export interface GlassProviderProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Shows a small live diagnostics panel. Disabled by default. */
  debug?: boolean;
  /** Override the conservative capability-based starting tier. */
  initialQuality?: Exclude<GlassQuality, "fallback">;
  /** Highest DPR used by the shared canvas. */
  maxDpr?: number;
  /** Coalesces background DOM mutations. */
  mutationDebounceMs?: number;
}
