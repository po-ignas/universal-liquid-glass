export type BackdropSourceState = "exact" | "scroll-compensated" | "invalid";

export interface BackdropSourceMetadata {
  captureGeneration: number;
  contentGeneration: number;
  captureScrollX: number;
  captureScrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  overscanX: number;
  overscanY: number;
}

export interface BackdropSourceView {
  contentGeneration: number;
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface BackdropSourceMapping {
  state: BackdropSourceState;
  deltaX: number;
  deltaY: number;
  offsetX: number;
  offsetY: number;
  sourceWidth: number;
  sourceHeight: number;
  remainingX: number;
  remainingY: number;
}

export function mapBackdropSource(
  source: BackdropSourceMetadata | null,
  view: BackdropSourceView,
): BackdropSourceMapping {
  if (!source) return {
    state: "invalid", deltaX: 0, deltaY: 0, offsetX: 0, offsetY: 0,
    sourceWidth: view.viewportWidth, sourceHeight: view.viewportHeight,
    remainingX: 0, remainingY: 0,
  };
  const deltaX = view.scrollX - source.captureScrollX;
  const deltaY = view.scrollY - source.captureScrollY;
  const dimensionsMatch = source.viewportWidth === view.viewportWidth && source.viewportHeight === view.viewportHeight;
  const contentMatches = source.contentGeneration === view.contentGeneration;
  const insideX = Math.abs(deltaX) <= source.overscanX;
  const insideY = Math.abs(deltaY) <= source.overscanY;
  const valid = dimensionsMatch && contentMatches && insideX && insideY;
  const exact = valid && deltaX === 0 && deltaY === 0;
  return {
    state: exact ? "exact" : valid ? "scroll-compensated" : "invalid",
    deltaX,
    deltaY,
    offsetX: source.overscanX + deltaX,
    offsetY: source.overscanY + deltaY,
    sourceWidth: source.viewportWidth + source.overscanX * 2,
    sourceHeight: source.viewportHeight + source.overscanY * 2,
    remainingX: Math.max(0, source.overscanX - Math.abs(deltaX)),
    remainingY: Math.max(0, source.overscanY - Math.abs(deltaY)),
  };
}
