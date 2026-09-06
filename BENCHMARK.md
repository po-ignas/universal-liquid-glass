# Benchmark

## Automated checks completed

Environment: macOS workspace, Node 24.9.0, npm 11.6.0.

| Check | Result |
|---|---|
| Strict TypeScript | pass |
| Unit tests | 15/15 pass |
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

## Optical calibration milestone

Verified on 2026-09-06 in Chromium at a 464×884 CSS viewport (DPR 2, 928×1768 WebGL canvas, 348×663 captured texture, HIGH tier) and at a 1280×720 desktop viewport.

The previous displacement profile applied a broad interior term and an edge band about 72% of a surface half-thickness wide. On a 440×56 mobile header this produced roughly 2 px of center displacement and more than 12 px at the lip before scattering, visibly duplicating large typography. The replacement derives an optical profile from normalized thickness and aspect ratio, squares the edge falloff, narrows the exponential lip, and makes scattering and chromatic separation follow that profile. The same 56 px header now has a sub-pixel center displacement and roughly 2.4 px peak normal displacement at the rim. No named internal/public material preset or surface default changed.

Manual optical acceptance results:

| Case | Result |
|---|---|
| Large typography under mobile header | one recognizable transmitted image; no full-height duplicate/smear; rim bends visibly |
| Concentric rings | coherent curvature at the edge; calm center; no magnifying band |
| Saturated yellow/orange under footer | natural color pickup, readable navigation, controlled bright lip |
| Mostly white backdrop | visible tint/rim without an opaque or invisible card |
| Desktop header | same thin-material language; real displacement remains distinguishable from blur |
| Ten arbitrary mobile scroll stops | no stale prior-position content; all passed visually |
| Exaggerated diagnostic | unmistakable displacement remains available and functional |
| Edge-mask diagnostic | strength is concentrated at the rim and falls rapidly toward the center |

The HIGH path still uses 13 scattering taps plus two chromatic samples; no texture-sample count was added. Default surface options remain `refraction: 1`, `blur: 3.5`, `chromaticAberration: 0.55`, white tint, and `tintOpacity: 0.075`.

## Milestone 1/2 regression during optical calibration

At the 464×884 Chromium viewport, a 6.1-second continuous scroll and a 4.9-second aggressive bidirectional scroll each recorded zero captures while active and exactly one coalesced capture after settle. Ten rapid stop/start inputs with a relevant DOM mutation also held at zero active captures and produced one final current-generation refresh. Eight viewport changes in a resize storm produced zero captures while resizing and one capture after settle. In every sampled stale state WebGL presentation was hidden; after each refresh the viewport and texture generations matched before WebGL became visible.

Settled capture durations in this pass were 81.7–89.7 ms on the mobile viewport and 86.7–89.4 ms during resize testing, so the policy remained `strict-idle-only`. Across active-scroll samples the rolling average was 8.3–9.1 ms. p95 was normally 9.0–9.2 ms but reached 16.6 ms during the instrumented continuous-scroll run; the recorded worst interval was 25.0 ms. The aggressive-scroll run settled at 8.3 ms average, 9.0 ms p95, and 9.3 ms worst. Long intervals are included rather than filtered.

Chromium was the only browser engine available for this milestone. Safari and Firefox optical/capture validation remains the next likely milestone; the post-settle DOM rasterization cost also remains an idle-only limitation.

## Interaction presentation parity

Verified on 2026-09-06 at 464×884 in Chromium. The temporary scroll presentation previously forced at least 8 px of CSS blur, 155% saturation, and about 13.5% default tint while the shallow-surface WebGL center used sub-pixel scattering and 7.5% tint. It also faded the stale canvas out over 110 ms, briefly compositing both treatments. The interaction path now uses 1.225 px blur for the default `blur: 3.5`, 112% saturation, and the configured 7.5% tint, and hides stale WebGL immediately. Side-by-side idle/active screenshots at a two-pixel scroll delta showed stable text clarity, tint, and backdrop color. The stronger permanent CSS fallback remains unchanged.

A subsequent 5.4-second continuous/bidirectional scroll recorded zero captures during interaction, hidden stale WebGL for every active sample, and exactly one refresh after settle. Active frame timing was 8.3 ms average, 8.9–9.2 ms p95, and 9.2–9.3 ms worst in this run. After settle, viewport and texture generations both reached 713 before WebGL became visible.

## Reproduction

Run `npm run demo`, then open `http://127.0.0.1:5173/?debug`. Add `&stress` for periodic relevant DOM mutations or `&fallback` to force the CSS fallback.
