"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PropsWithChildren,
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

function copyRuntimeState(source: Element, mirror: Element): void {
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
  displacement = 20,
  blur = 0.9,
  tint = "rgba(255,255,255,.14)",
  className,
  style,
  ...props
}: SvgLiveDomProviderProps) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const mirrorHostRef = useRef<HTMLDivElement>(null);
  const mirrorDocumentRef = useRef<HTMLElement | null>(null);
  const nodeMapRef = useRef(new WeakMap<Node, Node>());
  const frameRef = useRef(0);
  const rebuildRequestedRef = useRef(false);
  const [surfaces, setSurfaces] = useState<SurfaceRect[]>([]);
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
      if (lastFrameAtRef.current > 0 && now - lastFrameAtRef.current <= 100) {
        frameTimesRef.current.push(now - lastFrameAtRef.current);
        if (frameTimesRef.current.length > 240) frameTimesRef.current.shift();
      }
      lastFrameAtRef.current = now;
      syncTimesRef.current.push(performance.now() - syncStarted);
      if (syncTimesRef.current.length > 240) syncTimesRef.current.shift();
      if (now - lastMetricsAtRef.current >= 500) {
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
      }
    };

    const scheduleAlignment = () => {
      if (!frameRef.current) frameRef.current = window.requestAnimationFrame(alignMirror);
    };

    const rebuildMirror = () => {
      rebuildRequestedRef.current = false;
      const started = performance.now();
      const prepared = prepareMirror(source);
      host.replaceChildren(prepared.root);
      mirrorDocumentRef.current = prepared.root;
      nodeMapRef.current = prepared.nodes;
      prepared.root.style.transform = `translate3d(${-window.scrollX}px, ${-window.scrollY}px, 0)`;
      const bodyStyle = getComputedStyle(document.body);
      host.style.background = bodyStyle.background;
      setDiagnostics((current) => ({ ...current, cloneCount: current.cloneCount + 1, lastCloneMs: performance.now() - started, mirroredNodes: prepared.count }));
      measureSurfaces();
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
    });

    const syncControl = (event: Event) => {
      const target = event.target;
      const mirror = target instanceof Node ? nodeMapRef.current.get(target) : null;
      if (target instanceof Element && mirror instanceof Element) copyRuntimeState(target, mirror);
    };

    surfaceObserver = new ResizeObserver(measureSurfaces);
    rebuildMirror();
    observer.observe(source, { subtree: true, childList: true, characterData: true, attributes: true });
    window.addEventListener("scroll", scheduleAlignment, { passive: true, capture: true });
    window.addEventListener("resize", scheduleAlignment, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleAlignment, { passive: true });
    window.visualViewport?.addEventListener("scroll", scheduleAlignment, { passive: true });
    source.addEventListener("input", syncControl, true);
    source.addEventListener("change", syncControl, true);
    return () => {
      destroyed = true;
      observer.disconnect();
      surfaceObserver?.disconnect();
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      window.removeEventListener("scroll", scheduleAlignment, true);
      window.removeEventListener("resize", scheduleAlignment);
      window.visualViewport?.removeEventListener("resize", scheduleAlignment);
      window.visualViewport?.removeEventListener("scroll", scheduleAlignment);
      source.removeEventListener("input", syncControl, true);
      source.removeEventListener("change", syncControl, true);
    };
  }, []);

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
        <filter id={filterId} x="-6%" y="-8%" width="112%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.008" numOctaves={1} seed={7} result="rawDistortion" />
          <feGaussianBlur in="rawDistortion" stdDeviation={14} result="distortionMap" />
          <feDisplacementMap in="SourceGraphic" in2="distortionMap" scale={displacement} xChannelSelector="R" yChannelSelector="B" result="warped" />
          <feGaussianBlur in="warped" stdDeviation={blur} result="softened" />
          <feColorMatrix in="softened" type="saturate" values="1.08" />
        </filter>
      </defs>
    </svg>
    <div data-svg-live-layer="" aria-hidden="true" style={layerStyle}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", contain: "strict", filter: `url(#${filterId})` }}>
        <div ref={mirrorHostRef} style={{ position: "absolute", inset: 0, width: "100vw", willChange: "transform" }} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: tint, boxShadow: "inset 0 1px rgba(255,255,255,.72)" }} />
    </div>
    {debug && <output data-svg-live-debug="" style={{ position: "fixed", zIndex: 2147483647, left: 8, bottom: 8, padding: "7px 9px", borderRadius: 8, color: "#d9ff65", background: "rgba(7,21,47,.92)", font: "11px/1.35 ui-monospace,monospace", pointerEvents: "none", whiteSpace: "pre" }}>{`SVG live DOM · ${surfaces.length} surfaces\n${diagnostics.mirroredNodes} nodes · clone ${diagnostics.lastCloneMs.toFixed(1)} ms · rebuilds ${diagnostics.cloneCount}\nframe avg/p95/worst ${diagnostics.averageFrameMs.toFixed(1)} / ${diagnostics.p95FrameMs.toFixed(1)} / ${diagnostics.worstFrameMs.toFixed(1)} ms\nmirror sync avg ${diagnostics.averageSyncMs.toFixed(2)} ms`}</output>}
  </>;
}
