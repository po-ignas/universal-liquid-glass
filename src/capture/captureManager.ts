import html2canvas from "html2canvas-pro";

export interface ViewportCaptureOptions {
  root: HTMLElement;
  scale: number;
  ignore: (element: Element) => boolean;
  overscanX?: number;
  overscanY?: number;
}

/** Capture only the visible viewport, shared by every registered surface. */
export async function captureViewport({ root, scale, ignore, overscanX = 0, overscanY = 0 }: ViewportCaptureOptions): Promise<HTMLCanvasElement> {
  // Capturing the document element gives html2canvas its dedicated document-
  // bounds path. Cropping an arbitrary provider element with document-space
  // x/y can yield an empty canvas once the page scrolls.
  const captureRoot = root.ownerDocument.documentElement;
  return html2canvas(captureRoot, {
    backgroundColor: null,
    scale,
    width: window.innerWidth + overscanX * 2,
    height: window.innerHeight + overscanY * 2,
    x: 0,
    y: 0,
    // Render the cloned document in viewport space. Normal content is shifted
    // by the live scroll while fixed-position content remains fixed.
    scrollX: overscanX - window.scrollX,
    scrollY: overscanY - window.scrollY,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    logging: false,
    useCORS: true,
    removeContainer: true,
    ignoreElements: ignore,
  });
}
