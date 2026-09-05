export interface CaptureManagerOptions {
  minIntervalMs: number;
}

/**
 * Coordinates invalidation so scroll/resize/mutation bursts collapse into a
 * controlled number of expensive backdrop captures.
 * Actual DOM rasterization adapter is intentionally added in the next milestone.
 */
export class CaptureManager {
  private lastCaptureAt = -Infinity;
  private pending = false;

  constructor(private readonly options: CaptureManagerOptions) {}

  shouldCapture(now = performance.now()): boolean {
    return now - this.lastCaptureAt >= this.options.minIntervalMs;
  }

  markCaptured(now = performance.now()): void {
    this.lastCaptureAt = now;
    this.pending = false;
  }

  invalidate(): void {
    this.pending = true;
  }

  isPending(): boolean {
    return this.pending;
  }
}
