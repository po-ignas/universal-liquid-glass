# AGENTS.md

This repository builds a reusable, cross-browser Apple-like Liquid Glass renderer for React/Next.js.

Codex must read this file before making changes.

## Product priority

The priority order is strict:

1. Normal page speed and scroll responsiveness
2. Cross-browser reliability
3. Visual similarity to Apple Liquid Glass
4. API simplicity
5. Additional visual fidelity

The glass effect must degrade before the website does.

## Core architecture rules

- Use one shared WebGL2 renderer for all glass surfaces.
- Never create one WebGL context/canvas per `GlassSurface`.
- Normal text, buttons, links, icons, layout, accessibility and pointer interaction must remain regular DOM/React.
- WebGL is only the visual glass layer.
- Chromium must show real refraction. Blur-only output is not considered a successful WebGL implementation.
- Keep a lightweight CSS fallback for unsupported or performance-constrained situations.
- Reuse GPU resources. Do not allocate textures, buffers, programs or canvases inside the render loop.

## DOM capture is expensive

Treat DOM rasterization as an expensive, blocking operation.

Never assume that lowering screenshot resolution alone makes DOM capture cheap. `html2canvas`-style tools may spend substantial time cloning, traversing, styling, layouting and painting the DOM even when the final texture is small.

### Critical interaction rule

**There must be zero DOM captures while the user is actively scrolling.**

During active scroll:

- do not call `html2canvas-pro`
- do not start a new DOM rasterization job
- do not repeatedly invalidate the backdrop texture
- prioritize native browser scrolling and main-thread availability
- temporarily use lightweight CSS glass, or freeze/fade the last valid WebGL result if that benchmarks better

After scrolling settles:

- debounce approximately 120-160 ms
- coalesce the full gesture into one refresh
- perform exactly one backdrop capture
- upload the result to the existing WebGL texture
- redraw the refractive glass
- transition back to full WebGL glass smoothly

If a capture is already running when interaction starts, do not queue an unbounded chain of follow-up captures.

## Performance thresholds

Do not treat long capture times as acceptable simply because the library is already on LOW quality.

Guidance:

- < 25 ms capture: excellent
- 25-40 ms: acceptable for occasional refreshes
- 40-60 ms: idle-only work
- > 60 ms: strictly idle-only; never perform during interaction

A ~90 ms DOM capture is a serious main-thread stall and must not happen repeatedly during scrolling.

At 60 fps the browser has about 16.7 ms per frame. A 90 ms capture can eliminate several frame opportunities.

## Performance measurement rules

Measure bad frames instead of filtering them out.

- Never discard long frame intervals merely because they exceed a threshold.
- Track worst frame time.
- Track p95 frame time.
- Track current/average FPS carefully.
- Track last capture duration.
- Track captures during the current scroll gesture.
- Track captures in the last 10 seconds.
- Track active interaction mode versus idle mode.

The adaptive quality system must see jank rather than hiding it from its statistics.

## Adaptive quality

Use measured runtime performance as the final authority.

Hardware hints such as `hardwareConcurrency`, `deviceMemory`, DPR and WebGL2 availability may influence the initial tier, but actual capture cost and frame timing override them.

Preferred degradation path:

HIGH -> MEDIUM -> LOW -> interaction-safe CSS fallback

Do not continue reducing shader fidelity if the real bottleneck is DOM capture scheduling.

## Mutation invalidation

Do not rasterize the page for every incidental DOM mutation.

Mutation handling must:

- exclude all library canvas/surface/debug changes
- debounce/coalesce mutations aggressively
- avoid self-sustaining invalidation loops
- ignore irrelevant cosmetic/runtime mutations when possible
- prefer explicit invalidation for route changes, resize-settled, scroll-settled and known visual changes

A clock, pulse animation, debug overlay, transient class change or internal library style update must not cause continuous backdrop captures.

## Demo policy

The default demo must represent normal usage and should be mostly static.

Stress behaviors such as automatic DOM mutation, forced updates, repeated resize simulation or aggressive animation must be behind an explicit stress-test toggle.

The normal demo should make refraction visually obvious without intentionally creating pathological capture workload.

## Scope

Primary intended surfaces:

- desktop header
- mobile header
- mobile fixed footer/navigation

Optimize for these constrained, persistent glass regions before attempting a generic universal glass surface for arbitrary animated DOM.

## Development workflow

Before implementing a substantial subsystem:

1. inspect the existing implementation
2. identify the actual bottleneck from measurements
3. inspect mature open-source implementations when useful
4. verify licenses before deriving code
5. prefer proven techniques over reinvention
6. make the smallest architecture change that solves the measured problem
7. build and run the demo
8. test manual scroll, fast scroll, resize and idle
9. verify Chromium first, then Safari and Firefox
10. document any remaining limitation

Do not stop at planning if the task asks for implementation.

## Current performance milestone

The active implementation plan is documented in `PERFORMANCE_PLAN.md`.

Codex should treat the acceptance criteria in that file as the next milestone before spending time on visual shader tuning.
