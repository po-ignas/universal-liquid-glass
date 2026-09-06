# Universal Liquid Glass

A small React/Next.js library that renders visibly refractive, Apple-like glass over ordinary DOM content. It is optimized for a few high-value navigation surfaces: desktop headers, mobile headers, and fixed mobile navigation.

The WebGL2 layer bends a client-side snapshot of the real page with a curved rounded-rectangle lens, edge refraction, scattering, Fresnel-like rim light, directional specular light, tint, and restrained chromatic aberration. Text, buttons, links, focus behavior, and pointer interaction remain normal HTML above it.

## Install

This is a development release and is not published to npm. Install from the repository after pushing the desired commit:

```bash
npm install github:po-ignas/universal-liquid-glass
```

For local integration on this machine:

```bash
npm install /Users/vacuum/Desktop/universal-liquid-glass
```

The package runs its TypeScript build during Git/local installation. React 18 or newer is a peer dependency.

## React / Next.js

```tsx
import { GlassProvider, GlassSurface } from "@po-ignas/universal-liquid-glass";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <GlassProvider>
      <GlassSurface className="desktop-header"><Header /></GlassSurface>
      {children}
      <GlassSurface className="mobile-footer"><MobileNavigation /></GlassSurface>
    </GlassProvider>
  );
}
```

Both components are marked `"use client"`, so they can be imported from a Next.js App Router tree. Mount one provider around the page area that supplies the backdrop. Do not nest a provider per surface.

The intentionally small surface API accepts normal `div` props plus `borderRadius`, `refraction` (default `1`; tuned range `0–2`), `blur`, `chromaticAberration` (`0–1`), `tint`, and `tintOpacity`. `GlassProvider` accepts `debug`, `initialQuality`, `maxDpr`, and `mutationDebounceMs`. Debug mode is off by default.

## Run the demo

```bash
npm install
npm run demo
```

Open `http://127.0.0.1:5173/?debug`. The page deliberately puts high-contrast type, rules, gradients, and cards behind fixed desktop/mobile navigation so real displacement is distinguishable from transparent blur.

## How it works

```text
ordinary DOM page
      ↓ occasional viewport capture (html2canvas-pro)
one reusable background texture
      ↓
one fixed WebGL2 canvas + one program + one quad buffer
      ↓ one draw per visible registered region
desktop header / mobile header / mobile footer
      ↑
accessible DOM content remains above the visual layer
```

The renderer captures only the viewport, not an arbitrarily tall document. Captures exclude the renderer, glass surfaces, and debug UI. Texture storage is reused with `texSubImage2D` whenever dimensions do not change. The render loop sleeps when nothing is dirty.

Scroll events are passive and start no DOM captures. During scrolling, settling, and the post-scroll capture, surfaces use lightweight CSS glass and the stale WebGL canvas stays hidden. Roughly 140 ms after scrolling settles, one coalesced capture refreshes the shared texture. Viewport and texture generations prevent an obsolete asynchronous result from becoming visible; WebGL returns only after the current generation uploads and draws successfully. Resize and mutation bursts use the same freshness contract. Route history changes invalidate the snapshot, and consumers can call `useGlassRenderer()?.invalidate()` after router events that do not emit `popstate`.

## Adaptive performance

Responsiveness wins over fidelity. Capability hints only seed the starting tier; measured frame and capture time use hysteresis to degrade in this order:

| Tier | Capture scale | Minimum cadence | Shader work | Canvas DPR cap |
|---|---:|---:|---|---:|
| High | 0.75× | 70 ms | 13 blur taps + chromatic split | 2× |
| Medium | 0.50× | 120 ms | 9 blur taps + chromatic split | 1.75× |
| Low | 0.35× | 220 ms | 5 blur taps, no chromatic split | 1.25× |
| Fallback | none | none | CSS blur/tint | 1× |

Measured frame pressure controls shader quality. Capture duration controls capture policy separately: captures above 60 ms are classified as strict idle-only work instead of weakening refraction to disguise DOM-rasterization cost. Two sustained stressed frame samples normally lower a tier; LOW requires three stressed samples before CSS fallback. Recovery is deliberately slower (eight comfortable samples).

## Browser support

- Chromium/Chrome: primary WebGL2 path; intended acceptance browser.
- Safari 15+: WebGL2 path where context creation and DOM capture succeed.
- Firefox 51+: WebGL2 path where context creation and DOM capture succeed.
- WebGL2 loss/unavailability or sustained unacceptable capture/frame cost: CSS translucent blur fallback.
- Reduced-motion preference starts at LOW. It does not disable refraction because the effect is static when idle.

The runtime contains no browser-specific SVG-filter refraction. That avoids Chromium-only `backdrop-filter: url(...)` behavior.

## Known limitations

- DOM rasterization is not a browser compositor API. Video frames, WebGL/canvas content, cross-origin images without CORS, iframes, complex filters, and some advanced CSS may be absent or stale in snapshots.
- Active scrolling temporarily uses CSS glass. A single expensive DOM rasterization still occurs after settle, but the previous viewport texture is never intentionally revealed at the new position.
- The shared canvas occupies z-index `1000` inside the provider isolation context and surfaces default to `1001`. Application overlays should establish a higher layer deliberately.
- Glass surfaces should not sit inside transformed ancestors; transforms change fixed-position and stacking behavior in browsers.
- One provider is designed for a handful of navigation surfaces, not hundreds of cards.
- Client-side route systems that do not emit `popstate` should call `invalidate()` after navigation.

## Verification

```bash
npm run typecheck
npm test
npm run demo:build
```

The debug overlay reports mode, active tier, interaction/capture state, viewport/texture/capture generations, texture freshness, WebGL visibility, frame timing/FPS, capture duration/count, surface geometry, and texture dimensions. See [BENCHMARK.md](./BENCHMARK.md) for the benchmark procedure and current environment status.

## Attribution

The implementation is original but informed by permissively licensed work from `Hla-aung/liquid-glass`, `el-gladiador/liquid-glass-react`, `StarKnightt/liquid-glass`, and `lucaperullo/simple-liquid-glass`. `archisvaze/liquid-glass` was inspected only; it had no license file and no source was copied. Details are in [RESEARCH.md](./RESEARCH.md) and [NOTICE](./NOTICE).
