"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
} from "react";

const SURFACE_SELECTOR = "[data-liquid-glass-surface]";
const MIRROR_EXCLUSION_SELECTOR = "[data-svg-live-ignore], [data-html2canvas-ignore], [data-liquid-glass-surface]";
const REFERENCE_ATTRIBUTES = ["for", "aria-activedescendant", "aria-controls", "aria-describedby", "aria-details", "aria-errormessage", "aria-flowto", "aria-labelledby", "aria-owns"];

interface SurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface SvgLiveDomProviderProps extends PropsWithChildren<Omit<HTMLAttributes<HTMLDivElement>, "children">> {
  /** Development diagnostics for clone/synchronization cost. */
  debug?: boolean;
  /** SVG displacement strength in CSS pixels. */
  displacement?: number;
  /** Gaussian scattering after displacement. */
  blur?: number;
  /** Stable translucent tint over every registered surface. */
  tint?: string;
  /** Optional full-screen cover shown until the first correct glass frame. */
  loadingOverlay?: ReactNode;
  /** Minimum overlay visibility, preventing a distracting one-frame flash. */
  minimumLoadingMs?: number;
}

interface Diagnostics {
  cloneCount: number;
  lastCloneMs: number;
  mirroredNodes: number;
  averageFrameMs: number;
  p95FrameMs: number;
  worstFrameMs: number;
  averageSyncMs: number;
}

interface ActiveScroller {
  mirror: HTMLElement;
  lastLeft: number;
  lastTop: number;
  stableFrames: number;
}

function animationIdentity(animation: Animation): string {
  if (typeof CSSAnimation !== "undefined" && animation instanceof CSSAnimation) return `css:${animation.animationName}`;
  if (typeof CSSTransition !== "undefined" && animation instanceof CSSTransition) return `transition:${animation.transitionProperty}`;
  return "waapi";
}

function prepareMirrorScroller(mirror: HTMLElement): void {
  // The source owns momentum and snapping. Letting the inert copy run its own
  // smooth scroll/snap timeline makes it trail or jump to a different card.
  mirror.style.setProperty("scroll-behavior", "auto", "important");
  mirror.style.setProperty("scroll-snap-type", "none", "important");
  mirror.style.setProperty("overflow-anchor", "none", "important");
}

function roundedBoxDistance(x: number, y: number, halfWidth: number, halfHeight: number, radius: number): number {
  const qx = Math.abs(x) - halfWidth + radius;
  const qy = Math.abs(y) - halfHeight + radius;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

function createLensDisplacementMap(rects: SurfaceRect[], viewportWidth: number, viewportHeight: number): string {
  const resolutionScale = Math.min(1, 1200 / Math.max(viewportWidth, viewportHeight));
  const width = Math.max(1, Math.round(viewportWidth * resolutionScale));
  const height = Math.max(1, Math.round(viewportHeight * resolutionScale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return "";
  const pixels = context.createImageData(width, height);
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    pixels.data[offset] = 128;
    pixels.data[offset + 1] = 128;
    pixels.data[offset + 2] = 128;
    pixels.data[offset + 3] = 255;
  }

  const distanceAt = (rect: SurfaceRect, x: number, y: number) => roundedBoxDistance(
    x - rect.x - rect.width / 2,
    y - rect.y - rect.height / 2,
    rect.width / 2,
    rect.height / 2,
    Math.max(0, Math.min(rect.radius, rect.width / 2, rect.height / 2)),
  );

  for (const rect of rects) {
    const left = Math.max(0, Math.floor(rect.x * resolutionScale));
    const right = Math.min(width, Math.ceil((rect.x + rect.width) * resolutionScale));
    const top = Math.max(0, Math.floor(rect.y * resolutionScale));
    const bottom = Math.min(height, Math.ceil((rect.y + rect.height) * resolutionScale));
    const bevel = Math.max(1, Math.min(112, Math.min(rect.width, rect.height) / 2 - 1));
    for (let py = top; py < bottom; py += 1) {
      for (let px = left; px < right; px += 1) {
        const x = (px + 0.5) / resolutionScale;
        const y = (py + 0.5) / resolutionScale;
        const distance = distanceAt(rect, x, y);
        if (distance > 0) continue;
        const depth = -distance;
        const progress = Math.min(1, depth / bevel);
        // A shallow optical cap: zero at the physical edge and flat centre,
        // strongest just inside the bevel like the Lens Local WebGL shader.
        const response = Math.sin(Math.PI * progress) * Math.pow(1 - progress, 0.32);
        if (response <= 0.001) continue;
        const epsilon = 0.75;
        const gradientX = distanceAt(rect, x + epsilon, y) - distanceAt(rect, x - epsilon, y);
        const gradientY = distanceAt(rect, x, y + epsilon) - distanceAt(rect, x, y - epsilon);
        const gradientLength = Math.hypot(gradientX, gradientY) || 1;
        const normalX = gradientX / gradientLength;
        const normalY = gradientY / gradientLength;
        const pixelOffset = (py * width + px) * 4;
        pixels.data[pixelOffset] = Math.round(128 + normalX * response * 127);
        pixels.data[pixelOffset + 2] = Math.round(128 + normalY * response * 127);
      }
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

function copyRuntimeState(source: Element, mirror: Element): void {
  if (source instanceof HTMLElement && mirror instanceof HTMLElement) {
    mirror.scrollLeft = source.scrollLeft;
    mirror.scrollTop = source.scrollTop;
  }
  if (source instanceof HTMLInputElement && mirror instanceof HTMLInputElement) {
    mirror.value = source.value;
    mirror.checked = source.checked;
  } else if (source instanceof HTMLTextAreaElement && mirror instanceof HTMLTextAreaElement) {
    mirror.value = source.value;
  } else if (source instanceof HTMLSelectElement && mirror instanceof HTMLSelectElement) {
    mirror.selectedIndex = source.selectedIndex;
  } else if (source instanceof HTMLDetailsElement && mirror instanceof HTMLDetailsElement) {
    mirror.open = source.open;
  } else if (source instanceof HTMLCanvasElement && mirror instanceof HTMLCanvasElement) {
    try {
      mirror.width = source.width;
      mirror.height = source.height;
      mirror.getContext("2d")?.drawImage(source, 0, 0);
    } catch { /* A WebGL/tainted canvas cannot be mirrored through 2D drawImage. */ }
  }
}

function sanitizeMirrorElement(element: Element): void {
  if (element.matches(MIRROR_EXCLUSION_SELECTOR) && element instanceof HTMLElement) {
    element.style.setProperty("visibility", "hidden", "important");
  }
  element.removeAttribute("id");
  element.removeAttribute("name");
  element.removeAttribute("autofocus");
  for (const attribute of REFERENCE_ATTRIBUTES) element.removeAttribute(attribute);
}

function mapMirrorSubtree(source: Node, mirror: Node, nodes: WeakMap<Node, Node>): number {
  const sourceWalker = document.createTreeWalker(source, NodeFilter.SHOW_ALL);
  const mirrorWalker = document.createTreeWalker(mirror, NodeFilter.SHOW_ALL);
  let sourceNode: Node | null = source;
  let mirrorNode: Node | null = mirror;
  let count = 0;
  while (sourceNode && mirrorNode) {
    nodes.set(sourceNode, mirrorNode);
    count += 1;
    if (sourceNode instanceof Element && mirrorNode instanceof Element) {
      copyRuntimeState(sourceNode, mirrorNode);
      sanitizeMirrorElement(mirrorNode);
    }
    sourceNode = sourceWalker.nextNode();
    mirrorNode = mirrorWalker.nextNode();
  }
  return count;
}

function prepareMirror(source: HTMLElement): { root: HTMLElement; nodes: WeakMap<Node, Node>; count: number } {
  const root = source.cloneNode(true) as HTMLElement;
  const nodes = new WeakMap<Node, Node>();
  const count = mapMirrorSubtree(source, root, nodes);

  root.removeAttribute("data-svg-live-source");
  root.setAttribute("data-svg-live-mirror", "");
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("inert", "");
  root.style.pointerEvents = "none";
  root.style.userSelect = "none";
  root.style.willChange = "transform";

  for (const element of root.querySelectorAll<HTMLElement>(MIRROR_EXCLUSION_SELECTOR)) {
    element.style.setProperty("visibility", "hidden", "important");
  }
  return { root, nodes, count };
}

function roundedRectPath(rect: SurfaceRect): string {
  const radius = Math.max(0, Math.min(rect.radius, rect.width / 2, rect.height / 2));
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  if (radius === 0) return `M${rect.x},${rect.y} H${right} V${bottom} H${rect.x} Z`;
  return `M${rect.x + radius},${rect.y} H${right - radius} A${radius},${radius} 0 0 1 ${right},${rect.y + radius} V${bottom - radius} A${radius},${radius} 0 0 1 ${right - radius},${bottom} H${rect.x + radius} A${radius},${radius} 0 0 1 ${rect.x},${bottom - radius} V${rect.y + radius} A${radius},${radius} 0 0 1 ${rect.x + radius},${rect.y} Z`;
}

export function SvgLiveDomProvider({
  children,
  debug = false,
  displacement = 32,
  blur = 1.4,
  tint = "rgba(255,255,255,.055)",
  loadingOverlay,
  minimumLoadingMs = 180,
  className,
  style,
  ...props
}: SvgLiveDomProviderProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const mirrorHostRef = useRef<HTMLDivElement>(null);
  const mirrorDocumentRef = useRef<HTMLElement | null>(null);
  const nodeMapRef = useRef(new WeakMap<Node, Node>());
  const frameRef = useRef(0);
  const visualFrameRef = useRef(0);
  const animationRefreshFrameRef = useRef(0);
  const rebuildRequestedRef = useRef(false);
  const activeScrollersRef = useRef(new Map<HTMLElement, ActiveScroller>());
  const animationPairsRef = useRef(new Map<Animation, Animation>());
  const [surfaces, setSurfaces] = useState<SurfaceRect[]>([]);
  const [lensMapUrl, setLensMapUrl] = useState("");
  const [geometryReady, setGeometryReady] = useState(false);
  const [glassReady, setGlassReady] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(Boolean(loadingOverlay));
  const frameTimesRef = useRef<number[]>([]);
  const syncTimesRef = useRef<number[]>([]);
  const lastFrameAtRef = useRef(0);
  const lastMetricsAtRef = useRef(0);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({ cloneCount: 0, lastCloneMs: 0, mirroredNodes: 0, averageFrameMs: 0, p95FrameMs: 0, worstFrameMs: 0, averageSyncMs: 0 });
  const filterId = `svg-live-filter-${useId().replace(/:/g, "")}`;

  useLayoutEffect(() => {
    const source = sourceRef.current;
    const host = mirrorHostRef.current;
    if (!source || !host) return;
    let destroyed = false;
    let surfaceObserver: ResizeObserver | null = null;

    const recordMetrics = (now: number) => {
      const frameDelta = now - lastFrameAtRef.current;
      if (lastFrameAtRef.current > 0 && frameDelta > 0.1 && frameDelta <= 100) {
        frameTimesRef.current.push(frameDelta);
        if (frameTimesRef.current.length > 240) frameTimesRef.current.shift();
      }
      if (frameDelta > 0.1) lastFrameAtRef.current = now;
      if (now - lastMetricsAtRef.current < 500) return;
      lastMetricsAtRef.current = now;
      const frames = [...frameTimesRef.current].sort((a, b) => a - b);
      const syncs = syncTimesRef.current;
      setDiagnostics((current) => ({
        ...current,
        averageFrameMs: frames.length ? frames.reduce((sum, value) => sum + value, 0) / frames.length : 0,
        p95FrameMs: frames[Math.floor(frames.length * 0.95)] ?? 0,
        worstFrameMs: frames.at(-1) ?? 0,
        averageSyncMs: syncs.length ? syncs.reduce((sum, value) => sum + value, 0) / syncs.length : 0,
      }));
    };

    const measureSurfaces = () => {
      if (destroyed) return;
      const next = Array.from(source.querySelectorAll<HTMLElement>(SURFACE_SELECTOR)).flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const computed = getComputedStyle(element);
        if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight || computed.display === "none" || computed.visibility === "hidden") return [];
        const parsedRadius = Number.parseFloat(computed.borderTopLeftRadius);
        return [{ x: rect.left, y: rect.top, width: rect.width, height: rect.height, radius: Number.isFinite(parsedRadius) ? parsedRadius : 0 }];
      });
      setSurfaces((current) => current.length === next.length && current.every((rect, index) => {
        const candidate = next[index];
        return Math.abs(rect.x - candidate.x) < 0.25
          && Math.abs(rect.y - candidate.y) < 0.25
          && Math.abs(rect.width - candidate.width) < 0.25
          && Math.abs(rect.height - candidate.height) < 0.25
          && Math.abs(rect.radius - candidate.radius) < 0.25;
      }) ? current : next);
      for (const element of source.querySelectorAll<HTMLElement>(SURFACE_SELECTOR)) surfaceObserver?.observe(element);
    };

    const alignMirror = (now: number) => {
      const syncStarted = performance.now();
      frameRef.current = 0;
      const mirror = mirrorDocumentRef.current;
      if (mirror) mirror.style.transform = `translate3d(${-window.scrollX}px, ${-window.scrollY}px, 0)`;
      measureSurfaces();
      syncTimesRef.current.push(performance.now() - syncStarted);
      if (syncTimesRef.current.length > 240) syncTimesRef.current.shift();
      recordMetrics(now);
    };

    const scheduleAlignment = () => {
      if (!frameRef.current) frameRef.current = window.requestAnimationFrame(alignMirror);
    };

    const scheduleVisualSync = () => {
      if (!visualFrameRef.current) visualFrameRef.current = window.requestAnimationFrame(syncVisualState);
    };

    const refreshAnimationPairs = () => {
      animationRefreshFrameRef.current = 0;
      const nextPairs = new Map<Animation, Animation>();
      const occurrenceByTarget = new Map<Element, Map<string, number>>();
      for (const sourceAnimation of source.getAnimations({ subtree: true })) {
        const effect = sourceAnimation.effect;
        if (!(effect instanceof KeyframeEffect)) continue;
        const sourceTarget = effect.target;
        if (!(sourceTarget instanceof Element)) continue;
        const mirrorTarget = nodeMapRef.current.get(sourceTarget);
        if (!(mirrorTarget instanceof Element)) continue;

        const identity = animationIdentity(sourceAnimation);
        const targetOccurrences = occurrenceByTarget.get(sourceTarget) ?? new Map<string, number>();
        const occurrence = targetOccurrences.get(identity) ?? 0;
        targetOccurrences.set(identity, occurrence + 1);
        occurrenceByTarget.set(sourceTarget, targetOccurrences);

        let mirrorAnimation = animationPairsRef.current.get(sourceAnimation);
        if (!mirrorAnimation) {
          mirrorAnimation = mirrorTarget.getAnimations().filter((candidate) => animationIdentity(candidate) === identity)[occurrence];
        }
        if (!mirrorAnimation && identity === "waapi") {
          try {
            mirrorAnimation = mirrorTarget.animate(effect.getKeyframes(), effect.getTiming());
          } catch { /* Some browser-owned animation effects cannot be recreated. */ }
        }
        if (!mirrorAnimation) continue;
        mirrorAnimation.pause();
        nextPairs.set(sourceAnimation, mirrorAnimation);
      }
      animationPairsRef.current = nextPairs;
      scheduleVisualSync();
    };

    const scheduleAnimationRefresh = () => {
      if (!animationRefreshFrameRef.current) animationRefreshFrameRef.current = window.requestAnimationFrame(refreshAnimationPairs);
    };

    function syncVisualState(now: number) {
      visualFrameRef.current = 0;
      const started = performance.now();
      for (const [sourceScroller, state] of activeScrollersRef.current) {
        const left = sourceScroller.scrollLeft;
        const top = sourceScroller.scrollTop;
        state.mirror.scrollLeft = left;
        state.mirror.scrollTop = top;
        if (Math.abs(left - state.lastLeft) < 0.01 && Math.abs(top - state.lastTop) < 0.01) state.stableFrames += 1;
        else state.stableFrames = 0;
        state.lastLeft = left;
        state.lastTop = top;
        if (state.stableFrames >= 8) activeScrollersRef.current.delete(sourceScroller);
      }

      let hasRunningAnimation = false;
      for (const [sourceAnimation, mirrorAnimation] of animationPairsRef.current) {
        if (sourceAnimation.playState === "idle") continue;
        try {
          mirrorAnimation.playbackRate = sourceAnimation.playbackRate;
          mirrorAnimation.currentTime = sourceAnimation.currentTime;
        } catch { /* A disconnected/replaced animation will be removed on refresh. */ }
        if (sourceAnimation.playState === "running") hasRunningAnimation = true;
      }

      syncTimesRef.current.push(performance.now() - started);
      if (syncTimesRef.current.length > 240) syncTimesRef.current.shift();
      recordMetrics(now);
      if (activeScrollersRef.current.size > 0 || hasRunningAnimation) scheduleVisualSync();
    }

    const rebuildMirror = () => {
      rebuildRequestedRef.current = false;
      const started = performance.now();
      const prepared = prepareMirror(source);
      animationPairsRef.current.clear();
      activeScrollersRef.current.clear();
      host.replaceChildren(prepared.root);
      mirrorDocumentRef.current = prepared.root;
      nodeMapRef.current = prepared.nodes;
      prepared.root.style.transform = `translate3d(${-window.scrollX}px, ${-window.scrollY}px, 0)`;
      const bodyStyle = getComputedStyle(document.body);
      host.style.background = bodyStyle.background;
      setDiagnostics((current) => ({ ...current, cloneCount: current.cloneCount + 1, lastCloneMs: performance.now() - started, mirroredNodes: prepared.count }));
      measureSurfaces();
      scheduleAnimationRefresh();
    };

    const scheduleRebuild = () => {
      if (rebuildRequestedRef.current) return;
      rebuildRequestedRef.current = true;
      window.requestAnimationFrame(() => { if (!destroyed && rebuildRequestedRef.current) rebuildMirror(); });
    };

    const observer = new MutationObserver((mutations) => {
      let rebuild = false;
      for (const mutation of mutations) {
        const targetElement = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (targetElement?.closest(MIRROR_EXCLUSION_SELECTOR)) continue;
        const mirrorTarget = nodeMapRef.current.get(mutation.target);
        if (!mirrorTarget) {
          rebuild = true;
          continue;
        }
        if (mutation.type === "childList") {
          for (const removed of mutation.removedNodes) nodeMapRef.current.get(removed)?.parentNode?.removeChild(nodeMapRef.current.get(removed)!);
          for (const added of mutation.addedNodes) {
            const addedMirror = added.cloneNode(true);
            mapMirrorSubtree(added, addedMirror, nodeMapRef.current);
            const nextMirror = mutation.nextSibling ? nodeMapRef.current.get(mutation.nextSibling) ?? null : null;
            mirrorTarget.insertBefore(addedMirror, nextMirror);
          }
          continue;
        }
        if (mutation.type === "characterData") mirrorTarget.nodeValue = mutation.target.nodeValue;
        if (mutation.type === "attributes" && mutation.target instanceof Element && mirrorTarget instanceof Element && mutation.attributeName) {
          if (mutation.attributeName === "id" || mutation.attributeName === "name" || mutation.attributeName === "autofocus" || REFERENCE_ATTRIBUTES.includes(mutation.attributeName)) continue;
          const value = mutation.target.getAttribute(mutation.attributeName);
          if (value === null) mirrorTarget.removeAttribute(mutation.attributeName);
          else mirrorTarget.setAttribute(mutation.attributeName, value);
          copyRuntimeState(mutation.target, mirrorTarget);
        }
      }
      if (rebuild) scheduleRebuild();
      else measureSurfaces();
      scheduleAnimationRefresh();
    });

    const syncControl = (event: Event) => {
      const target = event.target;
      const mirror = target instanceof Node ? nodeMapRef.current.get(target) : null;
      if (target instanceof Element && mirror instanceof Element) copyRuntimeState(target, mirror);
    };

    // Element scrolling (carousels, rails, nested panels) changes visual state
    // without changing DOM attributes, so MutationObserver cannot see it.
    // Mirror that state directly on the corresponding cloned element. Scroll
    // does not bubble, but a capturing listener on the source root receives it.
    const syncElementScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const mirror = nodeMapRef.current.get(target);
      if (!(mirror instanceof HTMLElement)) return;
      prepareMirrorScroller(mirror);
      mirror.scrollLeft = target.scrollLeft;
      mirror.scrollTop = target.scrollTop;
      activeScrollersRef.current.set(target, {
        mirror,
        lastLeft: target.scrollLeft,
        lastTop: target.scrollTop,
        stableFrames: 0,
      });
      scheduleVisualSync();
    };

    const refreshAnimations = () => scheduleAnimationRefresh();

    surfaceObserver = new ResizeObserver(measureSurfaces);
    rebuildMirror();
    observer.observe(source, { subtree: true, childList: true, characterData: true, attributes: true });
    window.addEventListener("scroll", scheduleAlignment, { passive: true, capture: true });
    window.addEventListener("resize", scheduleAlignment, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleAlignment, { passive: true });
    window.visualViewport?.addEventListener("scroll", scheduleAlignment, { passive: true });
    source.addEventListener("input", syncControl, true);
    source.addEventListener("change", syncControl, true);
    source.addEventListener("scroll", syncElementScroll, true);
    source.addEventListener("animationstart", refreshAnimations, true);
    source.addEventListener("animationcancel", refreshAnimations, true);
    source.addEventListener("animationend", refreshAnimations, true);
    source.addEventListener("transitionrun", refreshAnimations, true);
    source.addEventListener("transitioncancel", refreshAnimations, true);
    source.addEventListener("transitionend", refreshAnimations, true);
    return () => {
      destroyed = true;
      observer.disconnect();
      surfaceObserver?.disconnect();
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      if (visualFrameRef.current) window.cancelAnimationFrame(visualFrameRef.current);
      if (animationRefreshFrameRef.current) window.cancelAnimationFrame(animationRefreshFrameRef.current);
      activeScrollersRef.current.clear();
      animationPairsRef.current.clear();
      window.removeEventListener("scroll", scheduleAlignment, true);
      window.removeEventListener("resize", scheduleAlignment);
      window.visualViewport?.removeEventListener("resize", scheduleAlignment);
      window.visualViewport?.removeEventListener("scroll", scheduleAlignment);
      source.removeEventListener("input", syncControl, true);
      source.removeEventListener("change", syncControl, true);
      source.removeEventListener("scroll", syncElementScroll, true);
      source.removeEventListener("animationstart", refreshAnimations, true);
      source.removeEventListener("animationcancel", refreshAnimations, true);
      source.removeEventListener("animationend", refreshAnimations, true);
      source.removeEventListener("transitionrun", refreshAnimations, true);
      source.removeEventListener("transitioncancel", refreshAnimations, true);
      source.removeEventListener("transitionend", refreshAnimations, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (diagnostics.cloneCount === 0) return;
    setLensMapUrl(createLensDisplacementMap(surfaces, window.innerWidth, window.innerHeight));
    setGeometryReady(true);
  }, [diagnostics.cloneCount, surfaces]);

  useEffect(() => {
    if (!geometryReady || diagnostics.cloneCount === 0 || glassReady) return;
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let timer = 0;
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => {
      if (cancelled) return;
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          timer = window.setTimeout(() => { if (!cancelled) setGlassReady(true); }, Math.max(0, minimumLoadingMs));
        });
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(timer);
    };
  }, [diagnostics.cloneCount, geometryReady, glassReady, minimumLoadingMs]);

  useEffect(() => {
    if (loadingOverlay && !glassReady) setOverlayVisible(true);
  }, [glassReady, loadingOverlay]);

  const clipPath = surfaces.map(roundedRectPath).join(" ");
  const layerStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 999,
    overflow: "hidden",
    pointerEvents: "none",
    clipPath: clipPath ? `path("${clipPath}")` : "inset(0 100% 100% 0)",
  };

  return <>
    <div ref={sourceRef} data-svg-live-source="" className={className} style={style} {...props}>{children}</div>
    <svg aria-hidden="true" style={{ position: "fixed", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          {lensMapUrl
            ? <><feImage href={lensMapUrl} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="lensMap" /><feDisplacementMap in="SourceGraphic" in2="lensMap" scale={displacement * 0.8} xChannelSelector="R" yChannelSelector="B" result="warped" /></>
            : <feGaussianBlur in="SourceGraphic" stdDeviation={0.01} result="warped" />}
          <feGaussianBlur in="warped" stdDeviation={blur} result="softened" />
          <feColorMatrix in="softened" type="saturate" values="1.06" />
        </filter>
      </defs>
    </svg>
    <div data-svg-live-layer="" aria-hidden="true" style={layerStyle}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", contain: "strict", filter: `url(#${filterId})` }}>
        <div ref={mirrorHostRef} style={{ position: "absolute", inset: 0, width: "100vw", willChange: "transform" }} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: tint, boxShadow: "inset 0 1px rgba(255,255,255,.72)" }} />
      {surfaces.map((rect, index) => <div key={index} style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        borderRadius: rect.radius,
        border: "1px solid rgba(255,255,255,.66)",
        background: "linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,255,255,0) 44%,rgba(74,94,130,.035))",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,.82), inset 0 -1px 2px rgba(34,52,82,.13)",
      }} />)}
    </div>
    {overlayVisible && loadingOverlay && <div
      data-svg-live-loading=""
      aria-hidden={glassReady || undefined}
      onTransitionEnd={() => { if (glassReady) setOverlayVisible(false); }}
      style={{ position: "fixed", inset: 0, zIndex: 2147483646, opacity: glassReady ? 0 : 1, transition: "opacity 180ms ease", pointerEvents: glassReady ? "none" : "auto" }}
    >{loadingOverlay}</div>}
    {debug && !overlayVisible && <output data-svg-live-debug="" style={{ position: "fixed", zIndex: 2147483647, left: 8, bottom: 8, padding: "7px 9px", borderRadius: 8, color: "#d9ff65", background: "rgba(7,21,47,.92)", font: "11px/1.35 ui-monospace,monospace", pointerEvents: "none", whiteSpace: "pre" }}>{`SVG live DOM · ${surfaces.length} surfaces\n${diagnostics.mirroredNodes} nodes · clone ${diagnostics.lastCloneMs.toFixed(1)} ms · rebuilds ${diagnostics.cloneCount}\n${animationPairsRef.current.size} live animations · ${activeScrollersRef.current.size} active scrollers\nframe avg/p95/worst ${diagnostics.averageFrameMs.toFixed(1)} / ${diagnostics.p95FrameMs.toFixed(1)} / ${diagnostics.worstFrameMs.toFixed(1)} ms\nmirror sync avg ${diagnostics.averageSyncMs.toFixed(2)} ms`}</output>}
  </>;
}
