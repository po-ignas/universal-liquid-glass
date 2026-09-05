import type { GlassQuality, GlassQualityConfig } from "../types.js";

export const QUALITY_CONFIG: Record<GlassQuality, GlassQualityConfig> = {
  high: { captureScale: 0.75, minCaptureIntervalMs: 50, enableChromaticAberration: true, blurSamples: 13 },
  medium: { captureScale: 0.5, minCaptureIntervalMs: 100, enableChromaticAberration: true, blurSamples: 9 },
  low: { captureScale: 0.35, minCaptureIntervalMs: 180, enableChromaticAberration: false, blurSamples: 5 },
  fallback: { captureScale: 0, minCaptureIntervalMs: Infinity, enableChromaticAberration: false, blurSamples: 0 }
};

export function webgl2Available(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2"));
}

export function initialQuality(): GlassQuality {
  if (!webgl2Available()) return "fallback";
  if (typeof navigator === "undefined") return "medium";

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const reducedMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) return "low";
  if (memory !== undefined && memory <= 2) return "low";
  if (cores <= 4) return "low";
  if (cores >= 8 && (memory === undefined || memory >= 8)) return "high";
  return "medium";
}
