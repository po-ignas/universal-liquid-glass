# Benchmark

## Automated checks completed

Environment: macOS workspace, Node 24.9.0, npm 11.6.0.

| Check | Result |
|---|---|
| Strict TypeScript | pass |
| Unit tests | pass |
| Production demo build | pass |
| npm audit | 0 vulnerabilities |

## Scroll scheduling milestone

Measured in the Chromium in-app browser at a 1280×720 CSS viewport. The WebGL canvas was 2560×1440 at DPR 2 and the captured backdrop was 960×540 at 0.75 scale.

| Case | Captures during interaction | Captures after settle | Result |
|---|---:|---:|---|
| Slow continuous scroll, ~5 seconds | 0 | 1 | pass |
| Aggressive bidirectional scroll, ~5 seconds | 0 | 1 | pass |
| Four short gestures | 0 per gesture | 1 per gesture | pass |
| Relevant idle mutation | n/a | 1 coalesced | pass |
| Mutation during continuous scroll | 0 | 1 coalesced | pass |
| Continuous viewport resize | 0 | 1 | pass |
| Forced CSS fallback | 0 | 0 | pass |
| Normal demo without debug/stress | 0 | 1 | pass |

Observed settled DOM-capture durations were 92.0–111.2 ms in the scroll cases (an initial capture reached 138.3 ms), so the renderer correctly selected `strict-idle-only` capture policy without reducing WebGL refraction quality. During the measured scroll gestures the rolling frame average was 8.3 ms, p95 was 8.9–9.1 ms, and worst was 9.3 ms. The demo ran at the HIGH shader tier with a linked WebGL2 program, complete framebuffer, non-empty source texture, and no reported WebGL error.

The remaining unavoidable hitch is the single 90–111 ms DOM rasterization after settle. It is no longer on the active-scroll path, but reducing that settled cost would require a separately benchmarked capture-zone or non-DOM source architecture. Safari and Firefox were not available in this pass and still require cross-engine validation.

## Texture freshness milestone

The renderer now tracks independent viewport, in-flight capture, uploaded texture, and completed-draw generations. Automated race tests verify that scrolling or a DOM mutation during an asynchronous capture makes that result obsolete; an obsolete generation cannot be uploaded as current or satisfy the WebGL visibility predicate. CSS remains active for scrolling, settling, refreshing, capture failure, pending invalidation, and dirty geometry. A current-generation upload and draw followed by a fully idle scheduler is the only route back to visible WebGL.

## Reproduction

Run `npm run demo`, then open `http://127.0.0.1:5173/?debug`. Add `&stress` for periodic relevant DOM mutations or `&fallback` to force the CSS fallback.
