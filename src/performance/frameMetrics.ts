export interface FrameTimingSummary {
  averageFrameMs: number;
  p95FrameMs: number;
  worstFrameMs: number;
  fps: number;
}

/** Summarizes every sample in the bounded renderer window, including stalls. */
export function summarizeFrameTimes(frameTimes: readonly number[]): FrameTimingSummary {
  if (!frameTimes.length) return { averageFrameMs: 0, p95FrameMs: 0, worstFrameMs: 0, fps: 0 };
  const averageFrameMs = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
  const sorted = [...frameTimes].sort((left, right) => left - right);
  const p95FrameMs = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
  const worstFrameMs = sorted[sorted.length - 1] ?? 0;
  return {
    averageFrameMs,
    p95FrameMs,
    worstFrameMs,
    fps: Math.min(999, 1000 / averageFrameMs),
  };
}
