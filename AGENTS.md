# AGENTS.md

This repository builds a reusable, cross-browser Apple-like Liquid Glass renderer for React/Next.js.

Codex must read this file before making changes.

## Product priority

The priority order is strict:

1. Continuous real WebGL glass on capable devices, including during scrolling
2. Normal page speed, scroll responsiveness, and device stability
3. Cross-browser reliability
4. Visual similarity to Apple Liquid Glass
5. API simplicity
6. Additional visual fidelity

The main product requirement is now explicit:

> Capable devices must not switch from WebGL glass to CSS glass during scrolling.

A visible WebGL -> CSS -> WebGL transition is considered a product failure, even if it is technically smooth.

CSS is allowed only as a stable whole-session fallback for devices/browsers that cannot sustain continuous real glass safely. A fallback session should remain CSS at idle, during scroll, and after scroll rather than oscillating between rendering modes.

## Core architecture rules

- Use one shared WebGL2 renderer for all glass surfaces.
- Never create one WebGL context/canvas per `GlassSurface`.
- Normal text, buttons, links, icons, layout, accessibility and pointer interaction must remain regular DOM/React.
- WebGL is only the visual glass layer.
- Chromium must show real refraction. Blur-only output is not considered a successful WebGL implementation.
- Reuse GPU resources. Do not allocate textures, buffers, programs or canvases inside the render loop.
- Preserve the existing shader/material calibration unless the active milestone specifically requires a measured change.

## Continuous glass requirement

For capable devices the desired state is:

```text
idle -> WebGL
scroll -> WebGL
settle -> WebGL
```

Do not use temporary CSS interaction presentation as the target architecture for capable devices.

The active plan for achieving this is `NO_CSS_SCROLL.md`.

Potential techniques include faster backdrop acquisition, safe repeated capture, scroll-delta UV compensation, overscan, surface-specific capture, and stable runtime capability downgrade. Measure before choosing.

## Stable fallback requirement

If continuous WebGL cannot be sustained safely on a device/browser:

```text
idle -> CSS fallback
scroll -> CSS fallback
settle -> CSS fallback
```

Avoid repeated mode switching during normal interaction.

Runtime fallback decisions should rely primarily on measured frame/capture/memory behavior, with hardware signals used only as initial hints.

## Texture correctness contract

The renderer tracks viewport, capture, uploaded-texture, and completed-draw generations.

This remains a correctness invariant.

- Arbitrary stale textures must never be presented as exact current backdrops.
- Obsolete asynchronous captures must be discarded.
- Continuous mode may introduce an explicit `scroll-compensated` source state only when UV translation is mathematically valid and remains inside captured overscan.
- Distinguish exact-fresh, valid-scroll-compensated, and invalid source states.
- Do not weaken generation/race protection to keep WebGL visible.

## DOM capture performance

DOM rasterization is expensive until proven otherwise.

The current `html2canvas-pro` path has measured roughly 80-110 ms settled captures in Chromium. Do not run that path repeatedly during active scroll.

Milestone 4 must benchmark alternative capture engines/paths rather than assuming the current engine is permanent.

Measure:

- capture wall time
- main-thread impact
- repeated capture cadence
- memory growth
- texture upload time
- visual correctness

## Performance measurement rules

Measure bad frames instead of filtering them out.

- Track worst frame time.
- Track p95 frame time.
- Track current/average FPS carefully.
- Track capture duration/cadence.
- Track capture backlog.
- Track source state: exact / compensated / invalid.
- Track memory/context-loss behavior where practical.

The glass effect must never crash or severely degrade a phone merely to avoid CSS fallback.

## Adaptive capability

Use measured runtime performance as the final authority.

Hardware hints such as `hardwareConcurrency`, `deviceMemory`, DPR and WebGL2 availability may influence the initial decision, but actual performance overrides them.

Preferred high-level behavior:

```text
continuous WebGL trial
        |
        +-- sustainable -> stay continuous WebGL
        |
        +-- unsafe/slow -> downgrade once to stable CSS fallback
```

Do not repeatedly oscillate between WebGL and CSS on every scroll gesture.

## Mutation invalidation

Do not rasterize the page for every incidental DOM mutation.

Mutation handling must:

- exclude all library canvas/surface/debug changes
- debounce/coalesce mutations aggressively
- avoid self-sustaining invalidation loops
- ignore irrelevant cosmetic/runtime mutations when possible
- preserve continuous-mode correctness

If scroll-compensated source data is being used, a relevant DOM mutation may invalidate that compensation and require a new source strategy. Handle this explicitly.

## Demo policy

The default demo must expose errors rather than hide them.

Keep strong test content behind glass:

- very large typography
- concentric rings
- high-contrast lines/shapes
- saturated colors

The demo must make it obvious whether backdrop motion/refraction is live, frozen, stale, jumping, or CSS-based.

Stress behaviors should remain behind explicit test controls.

## Scope

Primary intended surfaces:

- desktop header
- mobile header
- mobile fixed footer/navigation

Optimize continuous glass for these constrained fixed navigation surfaces first. Do not expand into a general graphics framework prematurely.

## Development workflow

Before implementing a substantial subsystem:

1. inspect the existing implementation
2. identify the measured limitation
3. research mature open-source/native solutions when relevant
4. verify licenses before adding/deriving code
5. benchmark alternatives rather than guessing
6. preserve working milestones unless the new design demonstrably requires change
7. build and run the demo
8. test manual scroll, fast scroll, resize, mutation and prolonged use
9. verify Chromium first, then Safari and Firefox
10. document actual measurements and remaining limitations

Do not stop at planning if the task asks for implementation.

## Milestone status

### Milestone 1 — scroll performance

Historical success in Chromium: active scrolling became smooth by removing expensive DOM captures from the interaction path.

The zero-capture hybrid solution remains a useful fallback/reference architecture, but temporary CSS-on-scroll is no longer the target experience for capable devices.

### Milestone 2 — texture freshness

Considered successful in Chromium unless a reproducible stale-frame case is found.

Generation/race protection must be preserved and extended for continuous mode.

### Milestone 3 — optical calibration

Considered successful in Chromium as of 2026-09-06 unless a reproducible optical regression is found.

`OPTICAL_TUNING.md` is the completion record. Preserve the tuned material while working on continuous rendering.

### Milestone 4 — ACTIVE: continuous WebGL without temporary CSS

Read and execute `NO_CSS_SCROLL.md`.

The target is real WebGL refraction at idle, during scroll, and after scroll on capable devices, with no visible rendering-mode transition.

CSS is only a stable whole-session fallback for incapable/unsafe devices.

Do not mark Milestone 4 complete merely because CSS has been made visually closer to WebGL.
