export interface ViewportCaptureGeometry {
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  overscanX: number;
  overscanY: number;
}

export interface RegionCaptureGeometry extends ViewportCaptureGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface VerticalOverscanGeometry {
  viewportHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
  desiredViewportCount: number;
  maxTextureSize: number;
  maxPixelCount: number;
}

export function planVerticalOverscan(geometry: VerticalOverscanGeometry): number {
  if (geometry.scale <= 0 || geometry.sourceWidth <= 0 || geometry.sourceHeight <= 0) return 0;
  const desired = geometry.viewportHeight * geometry.desiredViewportCount;
  const widthPixels = Math.max(1, Math.ceil(geometry.sourceWidth * geometry.scale));
  const maxHeightFromTexture = geometry.maxTextureSize / geometry.scale;
  const maxHeightFromMemory = geometry.maxPixelCount / widthPixels / geometry.scale;
  const maxSourceHeight = Math.min(maxHeightFromTexture, maxHeightFromMemory);
  const availablePerSide = Math.max(0, (maxSourceHeight - geometry.sourceHeight) / 2);
  return Math.floor(Math.min(desired, availablePerSide));
}

export function planViewportCapture(geometry: ViewportCaptureGeometry) {
  return {
    x: geometry.scrollX - geometry.overscanX,
    y: geometry.scrollY - geometry.overscanY,
    width: geometry.viewportWidth + geometry.overscanX * 2,
    height: geometry.viewportHeight + geometry.overscanY * 2,
    // The crop is already expressed in absolute document coordinates. Clone
    // the document at its origin so html2canvas does not apply the live scroll
    // a second time while resolving document-root paint bounds.
    scrollX: 0,
    scrollY: 0,
    windowWidth: geometry.viewportWidth,
    windowHeight: geometry.viewportHeight,
  };
}

export function planRegionCapture(geometry: RegionCaptureGeometry) {
  return {
    x: geometry.scrollX + geometry.left - geometry.overscanX,
    y: geometry.scrollY + geometry.top - geometry.overscanY,
    width: geometry.width + geometry.overscanX * 2,
    height: geometry.height + geometry.overscanY * 2,
    scrollX: 0,
    scrollY: 0,
    windowWidth: geometry.viewportWidth,
    windowHeight: geometry.viewportHeight,
  };
}
