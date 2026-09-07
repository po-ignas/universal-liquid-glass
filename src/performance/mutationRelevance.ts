export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function rectCanAffectSurface(rect: RectLike, surfaces: readonly RectLike[], margin = 0): boolean {
  // A zero-area box can be a removed node's former container or an element
  // whose layout has not settled. Keep it conservative rather than missing a
  // potentially global layout change.
  if (rect.width <= 0 || rect.height <= 0) return true;
  return surfaces.some((surface) =>
    rect.right >= surface.left - margin
    && rect.left <= surface.right + margin
    && rect.bottom >= surface.top - margin
    && rect.top <= surface.bottom + margin,
  );
}
