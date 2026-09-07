export interface ViewportCaptureGeometry {
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  overscanX: number;
  overscanY: number;
}

export function planViewportCapture(geometry: ViewportCaptureGeometry) {
  return {
    x: geometry.scrollX - geometry.overscanX,
    y: geometry.scrollY - geometry.overscanY,
    width: geometry.viewportWidth + geometry.overscanX * 2,
    height: geometry.viewportHeight + geometry.overscanY * 2,
    scrollX: geometry.scrollX,
    scrollY: geometry.scrollY,
    windowWidth: geometry.viewportWidth,
    windowHeight: geometry.viewportHeight,
  };
}
