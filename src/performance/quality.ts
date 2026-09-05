import type { GlassQuality, GlassQualityConfig } from "../types.js";

export const QUALITY_CONFIG: Record<GlassQuality, GlassQualityConfig> = {
  high: { captureScale: 0.75, minCaptureIntervalMs: 70, blurSamples: 13, chromaticAberration: true, maxDpr: 2 },
  medium: { captureScale: 0.5, minCaptureIntervalMs: 120, blurSamples: 9, chromaticAberration: true, maxDpr: 1.75 },
  low: { captureScale: 0.35, minCaptureIntervalMs: 220, blurSamples: 5, chromaticAberration: false, maxDpr: 1.25 },
  fallback: { captureScale: 0, minCaptureIntervalMs: Infinity, blurSamples: 5, chromaticAberration: false, maxDpr: 1 },
};

export function webgl2Available(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function initialQuality(): GlassQuality {
  if (!webgl2Available()) return "fallback";
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const reducedMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || cores <= 2 || (memory !== undefined && memory <= 2)) return "low";
  if (cores >= 8 && (memory === undefined || memory >= 8)) return "high";
  return "medium";
}
