export interface TextureFreshnessSnapshot {
  viewportGeneration: number;
  textureGeneration: number;
  captureGeneration: number | null;
  drawnGeneration: number;
  textureFresh: boolean;
}

export interface WebglPresentationState {
  rendererAvailable: boolean;
  interactionMode: "idle" | "scrolling" | "resizing" | "settling" | "refreshing";
  captureInFlight: boolean;
  pendingCaptureReason: string | null;
  textureFresh: boolean;
  layoutDirty: boolean;
}

export function canPresentFreshWebgl(state: WebglPresentationState): boolean {
  return state.rendererAvailable
    && state.interactionMode === "idle"
    && !state.captureInFlight
    && !state.pendingCaptureReason
    && state.textureFresh
    && !state.layoutDirty;
}

/**
 * Tracks which logical viewport a capture, uploaded texture, and completed draw
 * belong to. An asynchronous capture can only advance freshness when it still
 * matches the latest invalidation generation.
 */
export class TextureFreshness {
  private viewportGeneration = 0;
  private textureGeneration = -1;
  private captureGeneration: number | null = null;
  private drawnGeneration = -1;

  get snapshot(): TextureFreshnessSnapshot {
    return {
      viewportGeneration: this.viewportGeneration,
      textureGeneration: this.textureGeneration,
      captureGeneration: this.captureGeneration,
      drawnGeneration: this.drawnGeneration,
      textureFresh: this.textureGeneration === this.viewportGeneration
        && this.drawnGeneration === this.viewportGeneration,
    };
  }

  invalidate(): number {
    this.viewportGeneration += 1;
    return this.viewportGeneration;
  }

  beginCapture(): number {
    this.captureGeneration = this.viewportGeneration;
    return this.captureGeneration;
  }

  isCaptureCurrent(generation: number): boolean {
    return this.captureGeneration === generation && this.viewportGeneration === generation;
  }

  markTextureUploaded(generation: number): boolean {
    if (!this.isCaptureCurrent(generation)) return false;
    this.textureGeneration = generation;
    this.drawnGeneration = -1;
    return true;
  }

  markDrawn(generation: number): boolean {
    if (!this.isCaptureCurrent(generation) || this.textureGeneration !== generation) return false;
    this.drawnGeneration = generation;
    return true;
  }

  finishCapture(generation: number): void {
    if (this.captureGeneration === generation) this.captureGeneration = null;
  }

  reset(): void {
    this.viewportGeneration = 0;
    this.textureGeneration = -1;
    this.captureGeneration = null;
    this.drawnGeneration = -1;
  }
}
