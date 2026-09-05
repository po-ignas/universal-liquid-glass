import { GlassProvider, GlassSurface } from "@po-ignas/universal-liquid-glass";

export function NavigationExample() {
  return (
    <GlassProvider>
      <header>
        <GlassSurface borderRadius={28} refraction={1} blur={4}>
          <nav aria-label="Primary navigation">Navigation content</nav>
        </GlassSurface>
      </header>
    </GlassProvider>
  );
}
