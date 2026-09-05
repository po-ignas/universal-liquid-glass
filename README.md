# Universal Liquid Glass

A small, performance-first Liquid Glass engine for the web.

The goal is not to reproduce Apple's private compositor APIs. The goal is to
produce a convincing refractive glass material across Chromium, Safari and
Firefox using WebGL2, while keeping normal HTML/React content accessible and
keeping page speed more important than the visual effect.

## Initial scope

This package is intentionally narrow:

- desktop header
- mobile header
- mobile footer
- one shared WebGL2 renderer
- DOM backdrop capture rather than server-side rendering
- normal DOM children above the visual glass layer
- adaptive quality based on real browser performance
- CSS fallback when WebGL2 is unavailable or too expensive

It is **not** intended to put refractive glass on hundreds of cards or to become
a general page renderer.

## Architecture

```text
Normal DOM / React page
        |
        +--> selective DOM capture --> shared background texture
                                      |
GlassSurface registry ----------------+
                                      v
                           one WebGL2 renderer
                                      |
                           refractive glass regions
                                      |
                         normal HTML children above
```

The runtime should spend performance budget only where glass is visible.

## Performance rules

1. Page responsiveness wins over glass quality.
2. Never create one WebGL context per glass element.
3. Never recapture the DOM every animation frame.
4. Coalesce scroll/resize/mutation invalidations.
5. Reduce capture resolution while moving; perform a cleaner capture when idle.
6. Pause work when glass is off-screen or hidden by the active responsive layout.
7. Use measured frame/capture performance rather than exact device-model detection.
8. Fall back gracefully instead of allowing glass to degrade scrolling.

### Planned quality tiers

| Tier | Capture scale | Capture cadence | Shader | Behavior |
|---|---:|---:|---|---|
| High | ~0.7-0.75 | responsive | full | strongest optics |
| Medium | ~0.5 | throttled | full/normal | default starting point |
| Low | ~0.35 | heavily throttled | reduced | protects interaction |
| Fallback | n/a | none | CSS | no WebGL2 / sustained poor performance |

The exact thresholds must be benchmarked rather than treated as fixed truths.

## Public API target

```tsx
<GlassProvider>
  <GlassSurface preset="navigation">
    <button>Menu</button>
  </GlassSurface>
</GlassProvider>
```

For the original application, the first consumers are expected to be:

```text
DesktopHeaderGlass
MobileHeaderGlass
MobileFooterGlass
```

## What belongs here

Generic engineering that can be reused between projects:

- WebGL renderer
- shaders / optics
- DOM capture manager
- surface registry
- adaptive quality controller
- React provider/surface wrappers
- browser fallback behavior

What does **not** belong here:

- business logic
- application navigation definitions
- customer data
- project-specific branding/content
- database/API code

## Source strategy

We are intentionally not installing two full Liquid Glass libraries and stacking
them together. We use proven implementations as references, then keep one small
runtime whose architecture is appropriate for navigation surfaces.

Before porting code, verify and preserve the upstream license/notice. Current
MIT-licensed references include Hla-aung/liquid-glass and
el-gladiador/liquid-glass-react.

## Status

`0.1.0` — architecture scaffold. The next milestone is a working WebGL2 renderer
and DOM-capture path in Chromium, followed by Safari/Firefox verification and
adaptive-quality benchmarking.
