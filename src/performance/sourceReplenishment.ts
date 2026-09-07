import type { BackdropSourceState } from "./backdropSource.js";

export type SourceReplenishmentDecision = "none" | "capture" | "recover";

export interface SourceReplenishmentInput {
  sourceState: BackdropSourceState;
  sourceReady: boolean;
  captureInFlight: boolean;
  capturesThisScrollGesture: number;
  captureMs: number;
  scrollVelocityY: number;
  remainingY: number;
  overscanY: number;
  viewportHeight: number;
}

const MAX_SAFE_ACTIVE_CAPTURE_MS = 180;

export function activeReplenishmentLimit(captureMs: number): number {
  if (captureMs <= 0 || captureMs <= 120) return 4;
  if (captureMs <= MAX_SAFE_ACTIVE_CAPTURE_MS) return 2;
  return 0;
}

export function replenishmentThreshold(input: SourceReplenishmentInput): number {
  const captureLeadMs = Math.max(input.captureMs, 80) + 50;
  const velocityLead = input.scrollVelocityY * captureLeadMs * 1.35;
  return Math.min(input.overscanY * 0.75, Math.max(input.viewportHeight * 0.75, velocityLead));
}

/**
 * Rolls a valid source forward while measured capture cost leaves enough
 * headroom. If the bounded active budget is exhausted, the caller keeps the
 * renderer alive and performs an exact recovery after the gesture settles.
 */
export function decideSourceReplenishment(input: SourceReplenishmentInput): SourceReplenishmentDecision {
  if (!input.sourceReady) return "none";
  if (input.sourceState === "invalid") return "recover";
  if (input.sourceState !== "scroll-compensated" || input.overscanY <= 0) return "none";
  if (input.captureInFlight) return "none";
  const exhaustionGuard = Math.max(64, input.viewportHeight * 0.15);
  const limit = activeReplenishmentLimit(input.captureMs);
  if (input.capturesThisScrollGesture >= limit) {
    return input.remainingY <= exhaustionGuard ? "recover" : "none";
  }
  if (input.remainingY > replenishmentThreshold(input)) return "none";
  return "capture";
}
