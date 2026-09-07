import html2canvas from "html2canvas-pro";
import { planRegionCapture, planViewportCapture } from "./captureGeometry.js";

export interface CaptureTimings {
  traversalMs: number;
  rasterMs: number;
  preparationMs: number;
}

export interface ViewportCaptureResult {
  canvas: HTMLCanvasElement;
  bitmap: ImageBitmap | HTMLCanvasElement;
  timings: CaptureTimings;
}

export interface ViewportCaptureOptions {
  root: HTMLElement;
  scale: number;
  ignore: (element: Element) => boolean;
  overscanX?: number;
  overscanY?: number;
  scrollX?: number;
  scrollY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  region?: { left: number; top: number; width: number; height: number };
}

const PRESERVE_LAYOUT_ATTRIBUTE = "data-liquid-glass-capture-hidden";
const CAPTURE_EXCLUSION_SELECTOR = "[data-html2canvas-ignore], [data-liquid-glass-capture-ignore]";

function prepareLayoutPreservingExclusions(document: Document): () => void {
  const excluded = Array.from(document.querySelectorAll<HTMLElement>(CAPTURE_EXCLUSION_SELECTOR));
  const originalValues = excluded.map((element) => ({
    html2canvas: element.getAttribute("data-html2canvas-ignore"),
    liquidGlass: element.getAttribute("data-liquid-glass-capture-ignore"),
  }));
  excluded.forEach((element, index) => {
    element.setAttribute(PRESERVE_LAYOUT_ATTRIBUTE, String(index));
    element.removeAttribute("data-html2canvas-ignore");
    element.removeAttribute("data-liquid-glass-capture-ignore");
  });
  return () => {
    excluded.forEach((element, index) => {
      if (originalValues[index].html2canvas !== null) element.setAttribute("data-html2canvas-ignore", originalValues[index].html2canvas ?? "");
      if (originalValues[index].liquidGlass !== null) element.setAttribute("data-liquid-glass-capture-ignore", originalValues[index].liquidGlass ?? "");
      element.removeAttribute(PRESERVE_LAYOUT_ATTRIBUTE);
    });
  };
}

function canPruneCaptureSubtree(element: Element, geometry: ReturnType<typeof planRegionCapture>): boolean {
  if (!element.ownerDocument.body?.contains(element)) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.contentVisibility === "hidden" || style.opacity === "0") return true;
  if (!element.childElementCount) return false;

  const rect = element.getBoundingClientRect();
  const left = rect.left + window.scrollX;
  const top = rect.top + window.scrollY;
  const outsideX = left + rect.width <= geometry.x || left >= geometry.x + geometry.width;
  const outsideY = top + rect.height <= geometry.y || top >= geometry.y + geometry.height;
  if (!outsideX && !outsideY) return false;

  // Descendants cannot paint outside a paint-containing or clipped axis, so
  // skipping this branch is exact rather than a visual approximation.
  const containsPaint = /(^|\s)(paint|strict|content)(\s|$)/.test(style.contain);
  const clipsX = style.overflowX !== "visible";
  const clipsY = style.overflowY !== "visible";
  return containsPaint || (outsideX && clipsX) || (outsideY && clipsY);
}

/** Capture only the visible viewport, shared by every registered surface. */
export async function captureViewport({
  root, scale, ignore, overscanX = 0, overscanY = 0,
  scrollX = window.scrollX, scrollY = window.scrollY,
  viewportWidth = window.innerWidth, viewportHeight = window.innerHeight, region,
}: ViewportCaptureOptions): Promise<ViewportCaptureResult> {
  // Capturing the document element gives html2canvas its dedicated document-
  // bounds path. Cropping an arbitrary provider element with document-space
  // x/y can yield an empty canvas once the page scrolls.
  const captureRoot = root.ownerDocument.documentElement;
  const geometry = region
    ? planRegionCapture({ scrollX, scrollY, viewportWidth, viewportHeight, overscanX, overscanY, ...region })
    : planViewportCapture({ scrollX, scrollY, viewportWidth, viewportHeight, overscanX, overscanY });
  // html2canvas normally removes data-html2canvas-ignore nodes from its clone.
  // Removing an in-flow header collapses the cloned layout and shifts every
  // source pixel above its live viewport coordinate. Keep those boxes in the
  // clone, but make their paint invisible instead.
  const restoreExclusions = prepareLayoutPreservingExclusions(root.ownerDocument);
  let capture: Promise<HTMLCanvasElement>;
  const traversalStarted = performance.now();
  try {
    // DocumentCloner snapshots the tree synchronously when html2canvas is
    // called. Restore live attributes immediately instead of leaving the app
    // annotated for the duration of a slow rasterization.
    capture = html2canvas(captureRoot, {
      backgroundColor: null,
      scale,
      ...geometry,
      logging: false,
      useCORS: true,
      removeContainer: true,
      ignoreElements: (element) => ignore(element) || canPruneCaptureSubtree(element, geometry),
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
  const traversalMs = performance.now() - traversalStarted;
  const rasterStarted = performance.now();
  const canvas = await capture;
  const rasterMs = performance.now() - rasterStarted;
  const preparationStarted = performance.now();
  const bitmap = typeof createImageBitmap === "function" ? await createImageBitmap(canvas) : canvas;
  return { canvas, bitmap, timings: { traversalMs, rasterMs, preparationMs: performance.now() - preparationStarted } };
}
