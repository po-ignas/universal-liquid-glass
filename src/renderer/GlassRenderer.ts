import type { GlassSurfaceOptions } from "../types.js";

export interface RegisteredSurface {
  element: HTMLElement;
  options: GlassSurfaceOptions;
}

/**
 * Shared-renderer shell. The WebGL2 shader/texture pipeline is the next milestone.
 * Keeping the registry API stable lets React integration remain thin.
 */
export class GlassRenderer {
  private readonly surfaces = new Set<RegisteredSurface>();

  add(element: HTMLElement, options: GlassSurfaceOptions = {}): () => void {
    const surface = { element, options };
    this.surfaces.add(surface);
    return () => this.surfaces.delete(surface);
  }

  get size(): number {
    return this.surfaces.size;
  }

  destroy(): void {
    this.surfaces.clear();
  }
}
