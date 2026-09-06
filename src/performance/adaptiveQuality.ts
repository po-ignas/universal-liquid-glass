import type { GlassQuality } from "../types.js";

const ORDER: GlassQuality[] = ["fallback", "low", "medium", "high"];

export interface PerformanceSample {
  averageFrameMs: number;
  p95FrameMs?: number;
  captureMs?: number;
}

/** Pure tier decision. Runtime hysteresis decides when to apply the result. */
export function adaptQuality(current: GlassQuality, sample: PerformanceSample): GlassQuality {
  const index = ORDER.indexOf(current);
  if (current === "fallback") return current;
  // Capture duration controls scheduling policy, not shader fidelity. A slow
  // DOM rasterization must move out of interaction, not erase refraction.
  const stressed = sample.averageFrameMs > 23 || (sample.p95FrameMs ?? 0) > 42;
  const comfortable = sample.averageFrameMs > 0 && sample.averageFrameMs < 15.5 && (sample.captureMs ?? 0) < 38;
  if (stressed) return ORDER[Math.max(0, index - 1)];
  if (comfortable) return ORDER[Math.min(ORDER.length - 1, index + 1)];
  return current;
}
