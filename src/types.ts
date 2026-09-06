import type { CSSProperties, ReactNode } from "react";

export type GlassQuality = "high" | "medium" | "low" | "fallback";
export type GlassInteractionMode = "idle" | "scrolling" | "resizing" | "settling" | "refreshing";
export type GlassCapturePolicy = "dynamic" | "occasional" | "idle-only" | "strict-idle-only";

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
  lastFrameMs: number;
  p95FrameMs: number;
  worstFrameMs: number;
  fps: number;
  captureMs: number;
  averageCaptureMs: number;
  captureScale: number;
  captureCount: number;
  capturesThisScrollGesture: number;
  capturesLast10Seconds: number;
  interactionMode: GlassInteractionMode;
  capturePolicy: GlassCapturePolicy;
  pendingCaptureReason: string | null;
  captureInFlight: boolean;
  textureFreshness: "fresh" | "stale";
  viewportGeneration: number;
  textureGeneration: number;
  captureGeneration: number | null;
  webglPresentation: "visible" | "hidden";
  surfaceCount: number;
  textureWidth: number;
  textureHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  dpr: number;
  webglVersion: string;
  shaderStatus: string;
  framebufferStatus: string;
  sourceStatus: string;
  debugView: GlassDebugView;
  surfaceRect: string;
  sampledUvs: string;
  lastInvalidation: string;
  lastRenderError: string;
}

export type GlassDebugView = "normal" | "sample" | "exaggerated";

export interface GlassProviderProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Shows a small live diagnostics panel. Disabled by default. */
  debug?: boolean;
  /** Override the conservative capability-based starting tier. */
  initialQuality?: GlassQuality;
  /** Highest DPR used by the shared canvas. */
  maxDpr?: number;
  /** Coalesces background DOM mutations. */
  mutationDebounceMs?: number;
}
