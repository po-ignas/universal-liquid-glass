# MVP — Retained Constrained Scene

## Question
Can a small retained mirror of only glass-relevant visual primitives eliminate repeated whole-DOM rasterization while keeping the current WebGL optics?

## MVP only
This is an architecture spike, not a production renderer. Stop after proof. No expensive regression suite.

## Must implement
- Wire the shared `examples/DeliveryMarketFaqFixture.tsx` into the demo and scroll it beneath fixed glass.
- Preserve the current WebGL liquid-glass shader where practical; change acquisition/source architecture, not optics.
- Build a deliberately narrow retained scene for the demo/FAQ-relevant primitives: text, solid/gradient backgrounds, rounded rectangles/borders and simple image/SVG/icon representation if needed.
- Initialize the scene once, then update only changed nodes/dirty bounds. Never globally rescan the DOM after initialization for ordinary FAQ updates.
- Treat scroll primarily as a camera/coordinate change where possible instead of re-rasterizing the scene.
- Skip definitely non-painting nodes (`display:none`, safely invisible/irrelevant subtrees) and nodes that cannot intersect the glass sampling zone.
- Unsupported complexity may use a clearly identified fallback or be ignored for this MVP.
- Show rough init/update/frame timings and fallback/capture count.

## Later ideas to preserve, not necessarily implement now
Dirty rectangles + shader overscan; tile/strip cache for newly exposed scroll areas; direct image/video/canvas source reuse; cached text; `texSubImage2D` patches; explicit opt-in renderable markers; shared declarative app state instead of DOM observation.

## Acceptance
Demo builds/opens; FAQ fixture present; glass visibly refracts it; scrolling and FAQ state/timer update work; steady state avoids full-document recapture; no fatal console errors; timings/blockers reported.

## Stop rule
Stop immediately after acceptance. Do not expand CSS coverage or optimize speculatively.
