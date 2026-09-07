"use client";

import { useEffect, useRef, type HTMLAttributes, type PropsWithChildren } from "react";
import type { GlassFlushEdges, GlassSurfaceOptions } from "../types.js";
import { useGlassRenderer } from "./GlassProvider.js";

export type GlassSurfaceProps = PropsWithChildren<HTMLAttributes<HTMLDivElement> & GlassSurfaceOptions>;

function serializeFlushEdges(value: GlassFlushEdges | undefined): string | undefined {
  if (value === undefined || value === "auto") return "auto";
  if (typeof value === "boolean") return value ? "all" : "none";
  return (["top", "right", "bottom", "left"] as const).filter((edge) => value[edge]).join(",") || "none";
}

export function GlassSurface({
  children, borderRadius, refraction, thickness, bevelWidth, ior, blur, specular,
  chromaticAberration, tint, tintOpacity, flushEdges, style, ...props
}: GlassSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const renderer = useGlassRenderer();

  useEffect(() => {
    if (!renderer || !ref.current) return;
    return renderer.add(ref.current, {
      borderRadius, refraction, thickness, bevelWidth, ior, blur, specular,
      chromaticAberration, tint, tintOpacity,
      flushEdges,
    });
  }, [renderer, borderRadius, refraction, thickness, bevelWidth, ior, blur, specular, chromaticAberration, tint, tintOpacity, flushEdges]);

  return (
    <div
      ref={ref}
      data-liquid-glass-surface=""
      data-liquid-glass-refraction={refraction}
      data-liquid-glass-bevel-width={bevelWidth}
      data-liquid-glass-blur={blur}
      data-liquid-glass-specular={specular}
      data-liquid-glass-tint={tint}
      data-liquid-glass-tint-opacity={tintOpacity}
      data-liquid-glass-flush-edges={serializeFlushEdges(flushEdges)}
      style={{ borderRadius, overflow: "hidden", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
