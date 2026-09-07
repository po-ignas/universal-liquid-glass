import type { GlassInteractionMode } from "../types.js";

export interface CaptureSchedulerSnapshot {
  interactionMode: GlassInteractionMode;
  pendingCaptureReason: string | null;
  captureInFlight: boolean;
  capturesThisScrollGesture: number;
}

/**
 * Coalesces renderer invalidations. Ordinary captures begin while idle or
 * settling; explicit bounded replenishments may begin while scrolling. Timers
 * stay in GlassRenderer so the transitions can be tested without a DOM.
 */
export class CaptureScheduler {
  private interactionMode: GlassInteractionMode = "idle";
  private pendingCaptureReason: string | null = null;
  private captureInFlight = false;
  private scrollGestureActive = false;
  private capturesThisScrollGesture = 0;

  get snapshot(): CaptureSchedulerSnapshot {
    return {
      interactionMode: this.interactionMode,
      pendingCaptureReason: this.pendingCaptureReason,
      captureInFlight: this.captureInFlight,
      capturesThisScrollGesture: this.capturesThisScrollGesture,
    };
  }

  queue(reason: string): void {
    if (!this.pendingCaptureReason) this.pendingCaptureReason = reason;
    else if (!this.pendingCaptureReason.split(" + ").includes(reason)) this.pendingCaptureReason += ` + ${reason}`;
  }

  beginScroll(reason?: string): void {
    if (this.interactionMode !== "scrolling") {
      this.capturesThisScrollGesture = 0;
      this.scrollGestureActive = true;
    }
    this.interactionMode = "scrolling";
    if (reason) this.queue(reason);
  }

  beginResize(reason = "resize settled"): void {
    if (this.interactionMode !== "scrolling") this.interactionMode = "resizing";
    this.queue(reason);
  }

  settle(reason?: string): void {
    if (reason) this.queue(reason);
    if (this.interactionMode !== "scrolling" && this.interactionMode !== "resizing") return;
    if (!this.pendingCaptureReason && !this.captureInFlight) {
      this.interactionMode = "idle";
      this.scrollGestureActive = false;
      return;
    }
    this.interactionMode = "settling";
  }

  beginCapture(): string | null {
    if (this.captureInFlight || !this.pendingCaptureReason) return null;
    if (this.interactionMode === "scrolling" || this.interactionMode === "resizing" || this.interactionMode === "refreshing") return null;
    const reason = this.pendingCaptureReason;
    this.pendingCaptureReason = null;
    this.captureInFlight = true;
    this.interactionMode = "refreshing";
    if (this.scrollGestureActive) this.capturesThisScrollGesture += 1;
    return reason;
  }

  beginCaptureDuringScroll(reason: string): string | null {
    if (this.captureInFlight || this.interactionMode !== "scrolling") return null;
    this.captureInFlight = true;
    this.capturesThisScrollGesture += 1;
    return reason;
  }

  finishCapture(): void {
    this.captureInFlight = false;
    if (this.interactionMode === "scrolling" || this.interactionMode === "resizing") return;
    if (this.pendingCaptureReason) {
      this.interactionMode = "settling";
      return;
    }
    this.interactionMode = "idle";
    this.scrollGestureActive = false;
  }

  reset(): void {
    this.interactionMode = "idle";
    this.pendingCaptureReason = null;
    this.captureInFlight = false;
    this.scrollGestureActive = false;
    this.capturesThisScrollGesture = 0;
  }
}
