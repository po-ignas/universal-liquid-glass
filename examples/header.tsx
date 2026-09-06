import { GlassProvider, GlassSurface } from "@po-ignas/universal-liquid-glass";

export function NavigationExample() {
  return (
    <GlassProvider>
      <header>
        <GlassSurface borderRadius={2} refraction={50} blur={100}>
          <nav aria-label="Primary navigation">Navigation content</nav>
        </GlassSurface>
      </header>
    </GlassProvider>
  );
}
