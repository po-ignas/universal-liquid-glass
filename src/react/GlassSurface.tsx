"use client";

import { useEffect, useRef, type HTMLAttributes, type PropsWithChildren } from "react";
import type { GlassSurfaceOptions } from "../types.js";
import { useGlassRenderer } from "./GlassProvider.js";

export type GlassSurfaceProps = PropsWithChildren<HTMLAttributes<HTMLDivElement> & GlassSurfaceOptions>;

export function GlassSurface({ children, borderRadius, refraction, blur, chromaticAberration, ...props }: GlassSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const renderer = useGlassRenderer();

  useEffect(() => {
    if (!ref.current) return;
    return renderer.add(ref.current, { borderRadius, refraction, blur, chromaticAberration });
  }, [renderer, borderRadius, refraction, blur, chromaticAberration]);

  return <div ref={ref} {...props}>{children}</div>;
}
