# MVP — Lens-local backdrop acquisition

## Goal

Test the smallest architectural change that could materially reduce the current backdrop pipeline cost without changing the tuned glass shader or public React API.

Current measured problem: full viewport DOM rasterization with `html2canvas-pro` costs roughly 80–110 ms. The shader itself is not the bottleneck.

The MVP question is:

> Can we make backdrop acquisition scale with the pixels/content that can actually influence a registered glass surface, instead of treating the entire viewport/document as equally relevant?

## Branch strategy

Use branches, not forks. Keep `main` as the known-good reference. This branch is the first narrow experiment.

## Realistic demo fixture

The demo now includes `examples/DeliveryMarketFaqFixture.tsx`, adapted from Delivery Market's `src/components/MobileJourneyFaqStrip.tsx`.

Why this fixture:

- it is real application-shaped React DOM rather than synthetic colored rectangles
- it has text, nested layout, a stateful expand/collapse path, conditional DOM, and a timer-driven active question
- this class of content was present when the Delivery Market integration exposed the expensive capture bottleneck
- the existing high-contrast optics content remains in the demo, so performance work cannot hide refraction/freshness failures

The fixture intentionally removes Delivery Market-specific Tailwind tokens, localization plumbing, `MutationObserver` dependency on `#price-calculator #faq`, and `lucide-react`; the DOM/state behavior relevant to backdrop capture remains.

## MVP scope

Do not rewrite the renderer or shader. Preserve generation/race correctness.

First measure three stages separately:

1. DOM traversal/rasterization wall time
2. resulting canvas/bitmap preparation time
3. GPU texture upload time

Then prototype a lens-local/source-band capture for the fixed desktop header and mobile header/footer. Capture bounds must include a guard band large enough for maximum shader displacement/scattering plus scroll overscan.

Important: cropping the output of a full DOM rasterization is not a success. The experiment only matters if it reduces real work or proves which stage remains dominant.

## Acceptance comparison

Run the same scroll sequence over:

- original synthetic demo content
- Delivery Market FAQ fixture collapsed
- FAQ fixture expanded
- FAQ question changing while near/under glass

Record capture median/p95, upload median/p95, frame p95/worst, texture dimensions/bytes, capture count/backlog, and source correctness.

A useful result is either:

- materially lower acquisition cost with correct pixels, or
- a clear measurement proving that lens-local output does not reduce rasterization cost, which tells us to move to a different acquisition architecture rather than polishing cropping.

## Preserved follow-up ideas — do not lose

These are intentionally **not** all part of MVP 1, but remain queued after the first measurement:

- Skip elements that cannot contribute pixels: `display:none`, `visibility:hidden`, zero-area/clipped-out nodes, transparent/no-paint branches where safely detectable.
- Intersect DOM work with `glass bounds + displacement/blur guard band`; ignore unrelated off-lens page regions.
- Classify sources: direct `<img>`, `<video>`, `<canvas>`/WebGL sources should be candidates for direct GPU/external-image reuse rather than DOM screenshot reconstruction.
- Reconstruct cheap CSS primitives (solid backgrounds, simple gradients/borders) from metadata; reserve rasterization for text/complex CSS.
- Cache static nodes/tiles and invalidate only dirty regions using MutationObserver/ResizeObserver plus explicit library exclusions.
- Use a texture atlas/dirty rectangles and `texSubImage2D` rather than re-uploading a whole backdrop texture when only a small region changes.
- For scrolling static content, maintain overscanned bands/tile cache and move UV origin from scroll delta; rasterize only newly exposed edge regions.
- Generate lens geometry/SDF/normal/displacement data once and keep it independent from changing backdrop pixels.
- Investigate `createImageBitmap()` and upload paths to determine whether CPU-to-GPU transfer is measurable after rasterization is reduced.
- Investigate OffscreenCanvas/worker assistance only after separating main-thread DOM/layout collection from serializable paint/display-list work.
- Longer-term source-aware display list: simple CSS reconstructed, GPU-addressable media reused, only complex DOM rasterized.
- Chromium native SVG/backdrop displacement can remain a zero-copy capability tier, but universal API behavior must not depend on that path being available in Safari/Firefox.
- Stable CSS fallback remains a whole-session safety tier, not a per-scroll presentation strategy for continuous-capable devices.

## Stop rule

Do the smallest implementation that answers the MVP question. Do not build a mini browser compositor yet. If lens-local capture cannot avoid the expensive full-tree rasterization, record it and move to the next branch/experiment.
