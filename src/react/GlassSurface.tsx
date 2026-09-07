"use client";

import { useEffect, useRef, type HTMLAttributes, type PropsWithChildren } from "react";
import type { GlassSurfaceOptions } from "../types.js";
import { useGlassRenderer } from "./GlassProvider.js";

export type GlassSurfaceProps = PropsWithChildren<HTMLAttributes<HTMLDivElement> & GlassSurfaceOptions>;

export function GlassSurface({
  children, borderRadius, refraction, thickness, bevelWidth, ior, blur, specular,
  chromaticAberration, tint, tintOpacity, style, ...props
}: GlassSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const renderer = useGlassRenderer();

  useEffect(() => {
    if (!renderer || !ref.current) return;
    return renderer.add(ref.current, {
      borderRadius, refraction, thickness, bevelWidth, ior, blur, specular,
      chromaticAberration, tint, tintOpacity,
    });
  }, [renderer, borderRadius, refraction, thickness, bevelWidth, ior, blur, specular, chromaticAberration, tint, tintOpacity]);

  return (
    <div
      ref={ref}
      data-liquid-glass-surface=""
      style={{ borderRadius, overflow: "hidden", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
