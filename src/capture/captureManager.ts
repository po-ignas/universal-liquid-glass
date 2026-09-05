import html2canvas from "html2canvas-pro";

export interface ViewportCaptureOptions {
  root: HTMLElement;
  scale: number;
  ignore: (element: Element) => boolean;
}

/** Capture only the visible viewport, shared by every registered surface. */
export async function captureViewport({ root, scale, ignore }: ViewportCaptureOptions): Promise<HTMLCanvasElement> {
  const rootRect = root.getBoundingClientRect();
  const rootDocumentLeft = rootRect.left + window.scrollX;
  const rootDocumentTop = rootRect.top + window.scrollY;
  return html2canvas(root, {
    backgroundColor: null,
    scale,
    width: window.innerWidth,
    height: window.innerHeight,
    x: Math.max(0, window.scrollX - rootDocumentLeft),
    y: Math.max(0, window.scrollY - rootDocumentTop),
    // The clone's viewport must match the live document scroll; x/y then crop
    // the root's document-space render down to that viewport.
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    logging: false,
    useCORS: true,
    removeContainer: true,
    ignoreElements: ignore,
  });
}
