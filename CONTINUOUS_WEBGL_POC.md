# Continuous WebGL Scroll POC — Technical State

Date: 2026-09-06

## Executive summary

The project now has a working Chromium proof of concept for continuous WebGL glass during a bounded scroll gesture.

The experiment proves the central hypothesis: a single oversized DOM capture can remain useful while the page scrolls when the renderer tracks the capture's scroll origin and translates backdrop UV sampling by the exact live scroll delta. Within the captured overscan, the same WebGL material remains visible at idle, during scrolling, and after scrolling. No DOM capture begins while the gesture is active, and there is no WebGL-to-CSS-to-WebGL presentation change.

This is a successful architecture proof, not a completed Milestone 4 implementation. The source is not replenished before its overscan is exhausted, the existing settled capture remains expensive, and only Chromium has been exercised.

## Project state by milestone

| Milestone | State | What is established |
| --- | --- | --- |
| 1 — scroll performance | Preserved | Active scrolling starts zero DOM captures. Expensive rasterization remains outside the active gesture. |
| 2 — texture freshness | Preserved and extended | Existing capture/upload/draw generation protection remains. A separately validated `scroll-compensated` source state is now recognized without pretending that it is exact-fresh. |
| 3 — optical calibration | Preserved | The shared renderer, refraction material, optical profile, sample tiers, and public `GlassSurface` options were not retuned. |
| 4 — continuous WebGL | POC proven, milestone still active | Continuous WebGL works in Chromium while the requested viewport remains inside one oversized capture. Replenishment, broader performance work, and platform validation remain undone. |

## What changed for the POC

### Overscanned capture

The existing `html2canvas-pro` path captures the viewport plus a deliberately generous vertical band. The requested band is three viewport heights above and below the capture origin, bounded by the GPU texture-size limit and a conservative temporary allocation ceiling.

The captured DOM is shifted so that the viewport represented at capture time begins at the overscan offset:

```text
capture canvas height = viewport height + 2 × vertical overscan
clone scroll Y        = vertical overscan - capture scroll Y
```

No alternative capture engine is part of this POC.

### Explicit source metadata and validity

Each uploaded backdrop records:

- capture and content generation
- capture `scrollX` and `scrollY`
- captured viewport dimensions
- horizontal and vertical overscan

The source is classified as:

- `exact`: viewport and content match and the current scroll position equals the capture origin;
- `scroll-compensated`: viewport and content still match and the known scroll delta remains inside overscan;
- `invalid`: dimensions/content changed or the scroll delta exceeded an available bound.

Horizontal overscan is currently zero, so horizontal scrolling invalidates the POC source.

### Live GPU sampling translation

For a valid source:

```text
deltaY        = currentScrollY - captureScrollY
sourceOffsetY = overscanY + deltaY
sampleUV      = (viewportPixel + sourceOffset) / sourceSize
```

The vertex shader applies this mapping on every WebGL draw. Refraction, blur sampling, and chromatic offsets are normalized against the enlarged source dimensions. The optical material itself is unchanged.

### Continuous presentation

Scroll invalidation still advances the viewport generation, but it does not mark unchanged DOM content as a different content generation. Consequently, a previously exact source can become explicitly scroll-compensated instead of being treated as arbitrary stale data.

WebGL remains present while that source is valid. The old interaction behavior that hid the WebGL canvas and activated temporary CSS glass on every wheel/touch/scroll gesture is bypassed for this path.

The capture scheduler still refuses to start a DOM capture while `interaction mode` is `scrolling`. After the existing 140 ms settle interval, one coalesced capture recenters the source around the new position. The old WebGL source remains visible while that settled capture is running.

## Chromium proof results

The POC was exercised using the existing demo's large typography, rings, and saturated cards.

Representative responsive test viewport:

- viewport: `464 × 884` CSS pixels
- capture scale: `0.75`
- source texture: `348 × 4641` pixels
- vertical overscan: `2652` CSS pixels
- tested active delta: `1037` CSS pixels
- overscan remaining at that sample: `1616` CSS pixels
- settled capture duration: approximately `80.5–87.0 ms`
- texture upload: approximately `3.0–3.9 ms`
- active-scroll frame average: `8.4 ms`
- active-scroll p95: `8.9 ms`
- active-scroll worst observed: `9.2 ms`
- reported display cadence: approximately `120 fps` on the test environment

Ten diagnostic samples were taken throughout one smooth scroll gesture. Every sample reported:

```text
interaction mode: scrolling
source state: scroll-compensated
webgl presentation: visible
captures this scroll gesture: 0
```

The total capture count remained unchanged during the gesture. After settling, one coalesced capture completed, the source returned to `exact`, and `webgl presentation` remained `visible`.

Visual inspection showed the fixed header sampling the same colored card physically moving underneath it. The color and geometry visible through the header moved with the page and retained the existing WebGL refraction rather than switching to CSS blur.

## How to run and inspect it

Start the demo:

```bash
npm run demo
```

Open:

```text
http://127.0.0.1:5173/?debug
```

Use the `POC scroll down` and `POC scroll top` controls. During motion, verify:

- `renderer: webgl2`
- `source state: scroll-compensated`
- `scroll delta` changes with page movement
- `overscan remaining` decreases
- `webgl presentation: visible`
- `captures this scroll gesture: 0`
- `fallback: false`
- `total captures` does not change until the gesture settles

For pixel-alignment inspection, select the `sample` debug view. For unmistakable optical displacement, select `exaggerated`, then return to `normal` for the calibrated material.

## Automated verification

The source mapping has focused regression tests for:

- exact origin mapping
- valid compensated translation within overscan
- overscan exhaustion
- viewport resize
- horizontal movement without horizontal overscan
- content-generation invalidation
- recording a renderer-validated capture that completes at a still-representable compensated position

Current verification result:

```text
npm run typecheck   PASS
npm test            PASS — 19 tests
npm run demo:build  PASS
```

## What this POC does not solve

### No source replenishment

The renderer does not yet request an early replacement capture based on scroll velocity or remaining overscan. Once the current viewport moves outside the captured band, the source becomes `invalid`. Therefore continuous WebGL is proven only for a bounded gesture, not for arbitrary prolonged scrolling.

### Expensive settled capture remains

The measured `html2canvas-pro` capture is still roughly 80–87 ms in this test. It is correctly excluded from active scrolling, but the post-settle capture can still block the main thread. The POC proves cheap GPU motion between captures; it does not make DOM rasterization cheap.

### Overscan is intentionally coarse

The capture is a large, symmetric viewport band rather than source bands tailored to the fixed header/footer. At the top or bottom of a document, part of that allocation may represent unusable area. Texture size, memory behavior, and optimal band geometry have not been tuned.

### Ordinary-flow scrolling is the validated case

Pure scroll-delta translation is correct for ordinary document-flow content behind fixed navigation. Arbitrary fixed/sticky elements, active CSS transforms, video, canvas/WebGL content, and meaningful DOM mutations during scrolling can require different invalidation or composition behavior and are not solved here.

### Platform and device scope is deliberately narrow

Only Chromium has been used for this proof. Firefox, Safari macOS, Android Chrome, and iPhone Safari remain untested. No claim about Milestone 4 product readiness or stable device fallback thresholds can be made yet.

### No production capability policy yet

The POC does not decide which devices should use continuous WebGL. Stable whole-session CSS fallback selection, sustained-memory thresholds, context-loss behavior, and prolonged-use measurements remain future work.

## Analytical conclusion

The previous visible snap was architectural: the renderer deliberately changed presentation systems during every scroll gesture. This POC removes that discontinuity for the representable range by treating scroll movement as a coordinate-mapping problem instead of a backdrop-recapture problem.

The result separates two costs clearly:

1. WebGL redraw and scroll-delta sampling are inexpensive enough to track scrolling continuously in the tested Chromium environment.
2. DOM pixel acquisition remains the expensive operation and determines how often the valid source can be replenished.

The next decision should therefore be based on manual evaluation of this POC. If its motion and alignment are satisfactory, the next narrow engineering step is bounded asynchronous replenishment before overscan exhaustion, followed by seamless WebGL-to-WebGL source rebasing. Capture-engine research, source-band optimization, fallback thresholds, and cross-browser/device testing should remain separate measured steps rather than being folded into this proof.
