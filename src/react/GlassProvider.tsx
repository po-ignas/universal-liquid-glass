"use client";

import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from "react";
import { GlassRenderer } from "../renderer/GlassRenderer.js";

const GlassContext = createContext<GlassRenderer | null>(null);

export function GlassProvider({ children }: PropsWithChildren) {
  const renderer = useMemo(() => new GlassRenderer(), []);
  useEffect(() => () => renderer.destroy(), [renderer]);
  return <GlassContext.Provider value={renderer}>{children}</GlassContext.Provider>;
}

export function useGlassRenderer(): GlassRenderer {
  const renderer = useContext(GlassContext);
  if (!renderer) throw new Error("GlassSurface must be inside GlassProvider");
  return renderer;
}
