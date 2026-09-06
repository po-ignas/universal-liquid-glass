"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GlassRenderer } from "../renderer/GlassRenderer.js";
import type { GlassMetrics, GlassProviderProps } from "../types.js";

const GlassContext = createContext<GlassRenderer | null>(null);

const EMPTY_METRICS: GlassMetrics = {
  mode: "fallback", quality: "fallback", averageFrameMs: 0, lastFrameMs: 0, p95FrameMs: 0, worstFrameMs: 0, fps: 0,
  captureMs: 0, averageCaptureMs: 0, captureScale: 0, captureCount: 0,
  capturesThisScrollGesture: 0, capturesLast10Seconds: 0, interactionMode: "idle", capturePolicy: "dynamic",
  pendingCaptureReason: null, captureInFlight: false, textureFreshness: "stale",
  viewportGeneration: 0, textureGeneration: -1, captureGeneration: null, webglPresentation: "hidden",
  surfaceCount: 0, textureWidth: 0, textureHeight: 0,
  canvasWidth: 0, canvasHeight: 0, viewportWidth: 0, viewportHeight: 0, dpr: 1,
  webglVersion: "unavailable", shaderStatus: "not initialized", framebufferStatus: "not checked",
  sourceStatus: "not captured", debugView: "normal", surfaceRect: "none", sampledUvs: "none", lastInvalidation: "none", lastRenderError: "none",
};

function DebugOverlay({ renderer }: { renderer: GlassRenderer | null }) {
  const metrics = useSyncExternalStore(
    renderer?.subscribe ?? (() => () => undefined),
    renderer?.getMetrics ?? (() => EMPTY_METRICS),
    () => EMPTY_METRICS,
  );
  return (
    <output data-liquid-glass-debug aria-live="polite" style={{
      position: "fixed", right: 12, bottom: 12, zIndex: 2147483647, padding: "9px 11px",
      borderRadius: 10, background: "rgba(9, 12, 20, .88)", color: "#d9f99d",
      font: "11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace", pointerEvents: "none",
      boxShadow: "0 8px 30px rgba(0,0,0,.25)", whiteSpace: "pre",
    }}>
      {`renderer: ${metrics.mode} · ${metrics.quality.toUpperCase()} · ${metrics.debugView}\ninteraction mode: ${metrics.interactionMode}\ntexture freshness: ${metrics.textureFreshness}\nviewport generation: ${metrics.viewportGeneration}\ntexture generation: ${metrics.textureGeneration}\ncapture generation: ${metrics.captureGeneration ?? "none"}\nwebgl presentation: ${metrics.webglPresentation}\ncaptures this scroll gesture: ${metrics.capturesThisScrollGesture}\ncaptures last 10 seconds: ${metrics.capturesLast10Seconds}\nlast capture: ${metrics.captureMs.toFixed(1)} ms · average: ${metrics.averageCaptureMs.toFixed(1)} ms\ncapture policy: ${metrics.capturePolicy}\npending capture: ${metrics.pendingCaptureReason ? `yes · ${metrics.pendingCaptureReason}` : "no"}\ncapture in flight: ${metrics.captureInFlight ? "yes" : "no"}\nframe ms last/avg/p95/worst: ${metrics.lastFrameMs.toFixed(1)} / ${metrics.averageFrameMs.toFixed(1)} / ${metrics.p95FrameMs.toFixed(1)} / ${metrics.worstFrameMs.toFixed(1)}\nfps: ${metrics.fps.toFixed(0)}\nWebGL version: ${metrics.webglVersion}\nshader status: ${metrics.shaderStatus}\nsource texture: ${metrics.textureWidth}×${metrics.textureHeight} (${metrics.sourceStatus})\ncanvas: ${metrics.canvasWidth}×${metrics.canvasHeight} · viewport: ${metrics.viewportWidth}×${metrics.viewportHeight}\nDPR: ${metrics.dpr.toFixed(2)} · capture scale: ${metrics.captureScale.toFixed(2)}\nframebuffer: ${metrics.framebufferStatus} · fallback: ${metrics.mode === "fallback"}\nsurface rect: ${metrics.surfaceRect}\nsampled UV: ${metrics.sampledUvs}\nlast invalidation: ${metrics.lastInvalidation}\nWebGL/last error: ${metrics.lastRenderError}\ntotal captures: ${metrics.captureCount}`}
    </output>
  );
}

export function GlassProvider({
  children, className, style, debug = false, initialQuality, maxDpr = 2, mutationDebounceMs = 140,
}: GlassProviderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<GlassRenderer | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const instance = new GlassRenderer({ root: rootRef.current, initialQuality, maxDpr, mutationDebounceMs });
    setRenderer(instance);
    return () => { setRenderer(null); instance.destroy(); };
  }, [initialQuality, maxDpr, mutationDebounceMs]);

  return (
    <GlassContext.Provider value={renderer}>
      <div ref={rootRef} className={className} style={{ position: "relative", minHeight: "100%", isolation: "isolate", ...style }}>
        {children}
        {debug ? <DebugOverlay renderer={renderer} /> : null}
      </div>
    </GlassContext.Provider>
  );
}

export function useGlassRenderer(): GlassRenderer | null {
  return useContext(GlassContext);
}
