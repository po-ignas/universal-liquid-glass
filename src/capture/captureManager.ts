import html2canvas from "html2canvas-pro";

export interface ViewportCaptureOptions {
  root: HTMLElement;
  scale: number;
  ignore: (element: Element) => boolean;
  overscanX?: number;
  overscanY?: number;
}

const PRESERVE_LAYOUT_ATTRIBUTE = "data-liquid-glass-capture-hidden";

function prepareLayoutPreservingExclusions(document: Document): () => void {
  const excluded = Array.from(document.querySelectorAll<HTMLElement>("[data-html2canvas-ignore]"));
  const originalValues = excluded.map((element) => element.getAttribute("data-html2canvas-ignore") ?? "");
  excluded.forEach((element, index) => {
    element.setAttribute(PRESERVE_LAYOUT_ATTRIBUTE, String(index));
    element.removeAttribute("data-html2canvas-ignore");
  });
  return () => {
    excluded.forEach((element, index) => {
      element.setAttribute("data-html2canvas-ignore", originalValues[index]);
      element.removeAttribute(PRESERVE_LAYOUT_ATTRIBUTE);
    });
  };
}

/** Capture only the visible viewport, shared by every registered surface. */
export async function captureViewport({ root, scale, ignore, overscanX = 0, overscanY = 0 }: ViewportCaptureOptions): Promise<HTMLCanvasElement> {
  // Capturing the document element gives html2canvas its dedicated document-
  // bounds path. Cropping an arbitrary provider element with document-space
  // x/y can yield an empty canvas once the page scrolls.
  const captureRoot = root.ownerDocument.documentElement;
  // html2canvas normally removes data-html2canvas-ignore nodes from its clone.
  // Removing an in-flow header collapses the cloned layout and shifts every
  // source pixel above its live viewport coordinate. Keep those boxes in the
  // clone, but make their paint invisible instead.
  const restoreExclusions = prepareLayoutPreservingExclusions(root.ownerDocument);
  let capture: Promise<HTMLCanvasElement>;
  try {
    // DocumentCloner snapshots the tree synchronously when html2canvas is
    // called. Restore live attributes immediately instead of leaving the app
    // annotated for the duration of a slow rasterization.
    capture = html2canvas(captureRoot, {
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
      onclone: (clonedDocument) => {
        for (const element of clonedDocument.querySelectorAll<HTMLElement>(`[${PRESERVE_LAYOUT_ATTRIBUTE}]`)) {
          element.style.setProperty("visibility", "hidden", "important");
          element.removeAttribute(PRESERVE_LAYOUT_ATTRIBUTE);
        }
      },
    });
  } finally {
    restoreExclusions();
  }
  return capture;
}
