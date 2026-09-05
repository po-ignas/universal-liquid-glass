import type { GlassQuality } from "../types.js";

const ORDER: GlassQuality[] = ["fallback", "low", "medium", "high"];

export interface PerformanceSample {
  averageFrameMs: number;
  captureMs?: number;
}

export function adaptQuality(current: GlassQuality, sample: PerformanceSample): GlassQuality {
  if (current === "fallback") return current;
  const index = ORDER.indexOf(current);
  const stressed = sample.averageFrameMs > 22 || (sample.captureMs ?? 0) > 90;
  const comfortable = sample.averageFrameMs < 15 && (sample.captureMs ?? 0) < 45;

  if (stressed) return ORDER[Math.max(1, index - 1)];
  if (comfortable) return ORDER[Math.min(ORDER.length - 1, index + 1)];
  return current;
}
