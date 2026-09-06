# Continuous WebGL Scroll Plan

## Status

Milestone 4: **ACTIVE — continuous WebGL on ordinary capable devices**

This milestone builds directly on the existing implementation. **Do not restart or broadly refactor the library.**

Preserve:

- shared WebGL2 renderer
- existing liquid-glass shader and optical tuning
- React `GlassProvider` / `GlassSurface` API
- texture upload/draw path
- viewport/capture/texture/drawn generation safeguards
- diagnostics infrastructure
- current CSS fallback implementation as an emergency whole-session fallback
- existing demo and regression tests

The narrow problem is now:

> Feed the existing WebGL renderer sufficiently current backdrop pixels during scrolling, cheaply enough that ordinary devices can keep real refraction visible continuously.

Desired capable-device experience:

```text
IDLE -> WebGL
SCROLL -> WebGL
STOP -> WebGL
```

There must be no WebGL -> CSS -> WebGL interaction transition on continuous-capable devices.

CSS is only a stable whole-session fallback for genuinely unsupported/unsafe devices.

---

# 1. Success floor

Do not define "capable" so narrowly that only flagship hardware qualifies.

Target continuous WebGL for:

- ordinary modern Chromium desktop/laptop
- Firefox desktop
- Safari macOS
- ordinary recent Android Chrome phones
- ordinary recent iPhones/Safari

Actual support must be measured. Do not claim a platform passed without testing it.

If a typical recent mid-range phone falls back solely because our backdrop acquisition architecture is inefficient, Milestone 4 is **not solved**.

Fallback is intended for genuinely weak/old/unsupported or unstable configurations, not as the normal mobile experience.

---

# 2. What is already solved

Do not spend milestone time re-solving these unless a regression is proven:

- WebGL2 can render the glass material efficiently
- shader compiles and produces genuine refraction
- optical appearance has been tuned
- expensive DOM capture was identified as the major bottleneck
- scroll event handling can remain smooth when expensive capture is removed
- stale asynchronous captures are protected by generation tracking
- current CSS fallback exists

The research problem is **backdrop acquisition and source management**, not the glass shader.

---

# 3. Time-boxed capture benchmark FIRST

Before integrating another screenshot library deeply, build a small capture benchmark harness around the existing demo.

Benchmark only enough to answer: **which available path can provide correct backdrop pixels fastest and with the least main-thread disruption?**

Test, where practical and supported:

1. current `html2canvas-pro`
2. `html2canvas-pro` with `foreignObjectRendering`
3. `modern-screenshot`
4. `modern-screenshot` reusable/singleton context and worker-assisted path if applicable
5. SnapDOM
6. native/emerging HTML-in-Canvas / `drawElementImage()` only where actually exposed by the browser

Check licenses before adding dependencies.

### Stop rule

Do not spend a full implementation cycle polishing a candidate before measuring it.

For each candidate:

1. make the smallest benchmark integration
2. verify representative visual correctness
3. measure repeated capture
4. if it is not materially better or is incorrect, record the result and move on

Do not replace the production capture engine merely because a README claims it is faster.

### Measurements

Record at minimum:

- cold capture time
- warm/repeated capture median
- p95 capture time
- main-thread long-task impact
- texture dimensions
- memory trend over repeated captures
- correctness for fonts, images, gradients, pseudo-elements, transforms and clipping
- fixed/sticky behavior where relevant

Use the current representative mobile demo and a desktop viewport.

Test modest repeated cadences such as 1, 5, 10, 15 and 20 captures/sec only when safe.

### Decision rule

Prefer a backend that is both correct and materially faster. A change from ~90 ms to ~75 ms is not enough to justify a major integration by itself.

If no capture backend is sufficiently fast for live repeated capture, stop swapping screenshot libraries and proceed to scroll compensation using the best reliable backend.

---

# 4. Primary architecture experiment: overscan + scroll-delta compensation

This is the most important experiment in Milestone 4.

Do **not** require a new DOM capture for every display frame.

Scrolling gives us an exact movement value:

```text
captureScrollY = scroll position represented by source texture
currentScrollY = live scroll position
deltaY = currentScrollY - captureScrollY
```

When the captured source contains sufficient pixels above/below the currently sampled region, keep the existing WebGL shader running and offset backdrop sampling by `deltaY`.

Conceptually:

```text
CAPTURED SOURCE WITH OVERSCAN

+----------------------------+
| future backdrop pixels     |
|                            |
| +------------------------+ |
| | current glass sampling | |
| +------------------------+ |
|                            |
| previous backdrop pixels   |
+----------------------------+

scroll changes
      |
      v
change sampling origin immediately on GPU
      |
      v
WebGL glass remains live
      |
      v
fresh capture replenishes source asynchronously
```

The WebGL render loop may run at display refresh while DOM backdrop capture runs much less frequently.

---

# 5. Extend, do not remove, generation safeguards

Reuse the existing generation system.

Extend source validity into explicit states:

```text
EXACT
source texture exactly matches current backdrop state

SCROLL_COMPENSATED
source was captured at another scroll position, but the current sampling region is mathematically representable inside its overscan using known scroll delta

INVALID
source cannot correctly represent the current backdrop
```

Track at least:

- capture scrollX/Y
- current scrollX/Y
- scroll delta
- capture generation
- texture generation
- DOM/content generation if needed
- overscan bounds
- source state

An arbitrary stale texture must never be relabeled as compensated.

A fresh asynchronous capture that became obsolete before completion must still be discarded using the existing race protection.

---

# 6. Optimize for the real product surfaces

The first continuous implementation does **not** need to solve arbitrary full-screen glass.

Primary surfaces are:

- fixed desktop header
- fixed mobile header
- fixed mobile footer/navigation

These are small, constrained regions.

Investigate maintaining source bands around registered glass surfaces rather than treating the entire page as equally important.

Example mobile viewport:

```text
+---------------------------+
| HEADER SOURCE + OVERSCAN  |
+---------------------------+
|                           |
| ordinary page             |
|                           |
+---------------------------+
| FOOTER SOURCE + OVERSCAN  |
+---------------------------+
```

Important: simply cropping the output of a DOM screenshot may not reduce DOM traversal cost. Measure whether the chosen capture backend can genuinely avoid expensive full-document work.

Even when capture traversal cost does not improve, smaller textures can still reduce upload bandwidth and GPU memory; measure that separately.

---

# 7. Replenishment strategy

Once scroll compensation works, refresh the source asynchronously before compensated sampling runs out of valid overscan.

Do not hardcode a high capture frequency first.

Derive refresh behavior from:

- scroll velocity
- remaining overscan
- measured capture duration
- whether a capture is already in flight
- current source validity

Desired behavior:

```text
WebGL renders continuously
        |
        +-- live scroll delta moves sampling every frame
        |
        +-- source approaches overscan boundary
        |
        +-- one refresh is requested early enough
        |
        +-- new source arrives
        |
        +-- texture swap/update is seamless
```

Maximum one capture in flight.

Keep pending work bounded. Never create a capture backlog during fast scrolling.

---

# 8. Seamless source replacement

A new texture must not produce the old `chuck-chuck` visual transition.

When a fresh source arrives:

- validate that it is still current/usable
- upload it to the existing texture path
- align sampling coordinates correctly
- swap/rebase the capture origin without a visible positional jump
- preserve the same WebGL material continuously

Do not fade to CSS while replacing the source.

If a short WebGL-to-WebGL crossfade is required to hide unavoidable raster differences, benchmark it and keep both layers within WebGL. Prefer exact coordinate rebasing first.

---

# 9. Hard cases: keep scope disciplined

Pure scroll translation is not valid for every visual element.

Audit:

- normal document-flow content
- `position: fixed`
- `position: sticky`
- CSS transforms/animations
- videos
- canvas/WebGL content
- route changes
- meaningful DOM mutations during scroll

Do not attempt to build a general browser compositor in this milestone.

First make ordinary scrolling content behind fixed navigation work extremely well.

For invalidating content:

- mark compensation invalid when necessary
- request a bounded refresh
- do not expose known-wrong pixels as if exact
- do not automatically drop to CSS for every normal mutation

Document unsupported/difficult content classes accurately.

---

# 10. Continuous mode must be tested before fallback thresholds

Do not spend significant time tuning device classification before the continuous architecture works.

First prove the best architecture on representative hardware.

Then define fallback thresholds from measurements.

The intended eventual decision is stable:

```text
startup / warm-up measurement
        |
        +-- continuous path sustainable -> WEBGL for entire session
        |
        +-- WebGL unavailable or proven unsafe -> CSS for entire session
```

A runtime may downgrade once if prolonged measurements show severe instability, context loss, runaway memory or unacceptable sustained jank.

Do not oscillate per scroll gesture.

---

# 11. Performance guardrails

For continuous WebGL mode:

- WebGL remains visible during scrolling
- no capture backlog
- maximum one expensive capture in flight
- bounded textures/memory
- no resource allocation per animation frame
- no WebGL context-loss loop
- no browser/tab crashes
- normal input remains responsive

Aim for smooth 60 Hz on ordinary target devices.

Do not require backdrop capture itself to run at 60 Hz. The point of compensation is to decouple WebGL frame rate from DOM capture rate.

Track:

- average frame ms
- p95 frame ms
- worst frame ms
- capture median/p95
- captures/sec
- capture backlog
- texture upload ms
- source state exact/compensated/invalid
- overscan remaining
- memory trend where practical

---

# 12. Safari/iOS requirement

Do not assume Apple's native Liquid Glass APIs are available to webpages. Safari webpages only receive exposed Web APIs, not privileged access to Apple's native compositor material.

However, Safari/iPhone is a **first-class target**, not an automatic CSS fallback.

Test continuous WebGL on:

- Safari macOS
- iPhone Safari where available

Keep source textures reasonably small. Header/footer source-band architecture is preferable to giant full-page canvases, especially on mobile.

Use browser-supported worker/off-main-thread capabilities where they actually help, but do not assume moving work to a worker makes DOM capture itself free.

Record actual Safari limitations instead of guessing.

---

# 13. Visual acceptance

Use the existing difficult demo content:

- very large typography
- concentric rings
- high-contrast lines
- saturated blocks

During scroll:

- real refraction remains visible
- backdrop motion tracks the page naturally
- no frozen-glass sensation
- no CSS-looking phase
- no wrong previous-position content
- no jump when a new source texture arrives
- header and footer remain visually coherent

The test must make failures obvious; do not simplify the demo to hide them.

---

# 14. Explicit non-goals / stop wasting effort here

During this milestone do NOT:

- redesign the liquid-glass shader
- retune optics unless continuous source management exposes a concrete shader regression
- rewrite the React public API
- rewrite the renderer from scratch
- polish CSS/WebGL transition parity
- make CSS the normal scrolling mode
- create a renderer/canvas per glass surface
- run current ~90 ms html2canvas captures repeatedly during scroll
- deeply integrate every screenshot library before benchmarking it
- spend large effort on perfect device-tier thresholds before continuous WebGL works
- attempt arbitrary full-page glass before fixed header/footer works

---

# 15. Implementation order — fastest route

Execute in this order and do not broaden scope without evidence:

1. Read `AGENTS.md`, this file, `PERFORMANCE_PLAN.md`, and `OPTICAL_TUNING.md`.
2. Confirm existing renderer/shader/generation tests still pass.
3. Build the minimal capture benchmark harness.
4. Benchmark the candidate capture paths with strict time-boxing.
5. Choose the fastest reliable capture path, or keep the current one if alternatives are not materially better.
6. Add capture-source metadata: scroll origin and overscan bounds.
7. Implement `EXACT / SCROLL_COMPENSATED / INVALID` source state.
8. Implement live scroll-delta UV compensation while keeping WebGL visible.
9. Add overscan to extend the useful lifetime of a capture.
10. Verify a slow scroll works with **zero CSS presentation**.
11. Add bounded asynchronous replenishment before overscan exhaustion.
12. Make fresh texture rebasing/swaps visually seamless.
13. Test fast scroll and repeated direction changes; ensure no capture backlog.
14. Optimize source bands for fixed header/footer only if measurement shows a real benefit.
15. Audit ordinary fixed/sticky/mutation cases and document invalidation behavior.
16. Test representative Chromium desktop first.
17. Test Firefox desktop.
18. Test Safari macOS.
19. Test Android Chrome / iPhone Safari when accessible; if not accessible, explicitly report that real-device validation remains pending.
20. Only now derive stable fallback thresholds from actual measurements.
21. Run build/tests and prolonged scrolling stability tests.
22. Update this file and benchmark docs with verified results.

If an experiment fails, record the measurement/reason and continue to the next narrow experiment. Do not silently return to temporary CSS-on-scroll and call the milestone complete.

---

# 16. Milestone 4 acceptance criteria

Milestone 4 is not passed merely because one powerful desktop can render WebGL continuously.

Minimum technical proof before calling the architecture successful:

- continuous WebGL at idle/scroll/stop in Chromium desktop
- real moving refraction during scroll
- no CSS interaction presentation
- no visible source-rebase jump
- bounded capture work and no queue
- stable prolonged scrolling
- generation/race correctness preserved
- benchmark evidence for capture backend choice

Broader product success additionally requires validation on Firefox, Safari, and representative mobile hardware.

If representative recent mobile hardware mostly falls back to CSS, report Milestone 4 as **not meeting the product goal**, even if fallback technically works.

---

# 17. Completion report

When work stops for this milestone, report concisely:

- capture engines/paths benchmarked
- cold/median/p95 timing for each
- chosen capture path and why
- whether scroll-delta compensation works
- overscan/source-band design
- WebGL frame avg/p95/worst during scroll
- capture cadence during slow and fast scroll
- whether any CSS presentation occurred in continuous mode
- source-rebase visual result
- capture backlog/memory/context-loss observations
- Chromium result
- Firefox result
- Safari result
- Android/iPhone result or explicit pending status
- actual device configurations that fell back
- remaining blockers to making continuous WebGL the normal experience
