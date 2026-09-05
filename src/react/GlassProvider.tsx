"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GlassRenderer } from "../renderer/GlassRenderer.js";
import type { GlassMetrics, GlassProviderProps } from "../types.js";

const GlassContext = createContext<GlassRenderer | null>(null);

const EMPTY_METRICS: GlassMetrics = {
  mode: "fallback", quality: "fallback", averageFrameMs: 0, fps: 0, captureMs: 0,
  captureScale: 0, captureCount: 0, surfaceCount: 0, textureWidth: 0, textureHeight: 0,
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
      {`${metrics.mode} · ${metrics.quality.toUpperCase()}\n${metrics.fps.toFixed(0)} fps · ${metrics.averageFrameMs.toFixed(1)} ms frame\n${metrics.captureMs.toFixed(1)} ms capture · ${metrics.captureScale.toFixed(2)}×\n${metrics.captureCount} captures · ${metrics.surfaceCount} surfaces\n${metrics.textureWidth}×${metrics.textureHeight} texture`}
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
