# Continuous WebGL Scroll Plan

## Status

Milestone 4: **ACTIVE — eliminate temporary CSS glass on capable devices**

The product requirement has changed and overrides the previous hybrid interaction strategy.

The desired experience is:

```text
capable device
IDLE -> real WebGL glass
SCROLL -> real WebGL glass
STOP -> real WebGL glass
```

There must be no visible mode switch between WebGL and CSS on capable hardware.

CSS glass is permitted only as a **whole-session fallback** when the runtime determines that continuous real glass cannot be sustained safely on the device/browser.

That fallback should remain CSS in both idle and scrolling states. Do not switch back and forth between CSS and WebGL during normal interaction on such devices.

---

# 1. Product requirement

The current hybrid architecture is performant but visually unsatisfactory because users can perceive:

```text
real glass
-> scroll begins
-> CSS approximation
-> scroll stops
-> real glass returns
```

That transition makes the effect feel simulated rather than native/premium.

For supported/capable devices, this milestone must remove that transition entirely.

The core success condition is:

> **The same WebGL glass material remains visible continuously before, during, and after scrolling.**

---

# 2. Safety requirement

Continuous WebGL glass must not come at the cost of unusable phones or severe jank.

The runtime must decide between two stable modes:

```text
MODE A — continuous-webgl
real refraction at idle + scroll + settle

MODE B — css-fallback
CSS presentation at idle + scroll + settle
```

Avoid a third mode where the app changes rendering technology during each scroll gesture.

The decision may adapt downward if the device cannot sustain MODE A, but once downgraded to CSS fallback it should remain stable for the session unless there is a strong reason to retry later.

---

# 3. First task: replace assumptions with benchmarks

Do not assume `html2canvas-pro` is the only backdrop acquisition path.

Research and benchmark current alternatives for repeated viewport capture, including where practical:

- current `html2canvas-pro` path
- `html2canvas-pro` foreignObject rendering mode
- `modern-screenshot`
- reusable/singleton-context paths from screenshot libraries
- worker-assisted paths where supported
- SnapDOM or equivalent DOM->SVG/foreignObject implementations
- native/emerging HTML-to-canvas APIs such as `drawElementImage()` / HTML-in-Canvas where actually available
- any mature browser API or compositor-adjacent approach that can provide equivalent pixels without rebuilding the whole DOM each frame

Check licenses before adding/deriving code.

Do not replace the current engine based on README claims. Build a benchmark harness and measure it on the exact demo.

---

# 4. Benchmark harness

Create a repeatable capture-engine benchmark using the current demo and representative mobile viewport.

Measure at minimum:

- capture wall time
- main-thread blocking / long-task impact
- resulting texture dimensions
- pixel correctness for current viewport
- support for fonts, gradients, images, pseudo-elements, clipping, transforms and fixed elements
- CORS behavior
- memory allocations
- repeated-capture stability
- whether the implementation can reuse a prepared DOM/SVG/context instead of rebuilding from scratch

Test repeated capture cadence such as:

```text
1 fps
5 fps
10 fps
15 fps
20 fps
30 fps
```

Do not run high cadences indefinitely if the browser becomes unstable. The goal is to determine a safe sustainable envelope.

---

# 5. Continuous scroll strategies to investigate

Do not assume the only solution is full fresh viewport capture on every frame.

Evaluate these strategies separately and in combination.

## A. Faster repeated capture

If a replacement engine can produce correct current viewport pixels cheaply enough, update the WebGL texture during scroll at a controlled cadence.

Potential target bands:

```text
<= 8 ms capture: strong candidate for high-frequency refresh
8-16 ms: candidate for moderate live refresh
16-30 ms: candidate for lower-frequency refresh with interpolation/compensation
>30 ms: unlikely to be safe for direct repeated capture during interaction
```

These are starting points, not guarantees. Measure actual frame performance.

## B. Scroll-compensated stale texture

Because a scroll is primarily a known translation of page content, test whether the previous captured texture can remain visually correct between fresh captures by compensating UVs using scroll delta.

Conceptually:

```text
capture at scrollY = A
current scrollY = B
delta = B - A

sample previous texture with UV offset corresponding to delta
```

This may keep the refracted backdrop moving correctly for a short interval without a new DOM capture.

Important constraints:

- captured viewport must contain enough overscan above/below the visible region
- fixed/sticky elements complicate pure translation
- animated/changed DOM can invalidate assumptions
- texture bounds must not reveal empty/incorrect pixels

If this works, combine it with periodic fresh captures rather than capturing every frame.

## C. Overscan capture

Capture a viewport larger than the visible glass sampling region so UV compensation has room during scrolling.

For fixed header/footer use, consider capture bands with vertical overscan rather than the entire viewport if that genuinely reduces work.

Example:

```text
header source band = visible header backdrop + generous vertical overscan
footer source band = visible footer backdrop + generous vertical overscan
```

Benchmark whether the selected capture engine actually avoids full DOM traversal when output is cropped. Do not assume crop == lower cost.

## D. Surface-specific backdrop source

The library's primary use is fixed desktop/mobile navigation, not arbitrary full-screen glass.

Investigate whether only the background required by registered surfaces can be represented/captured efficiently.

This may permit:

- small source textures
- independent overscan bands
- less upload bandwidth
- faster repeated updates

But only pursue it if capture-engine traversal cost also improves.

## E. Predictive / interpolation strategy

For very fast scroll velocity, test whether UV compensation can carry the material between lower-frequency capture updates.

Do not synthesize arbitrary page content or invent pixels beyond available overscan. Correctness is more important than hiding every capture.

---

# 6. Preferred continuous architecture

A promising target architecture is:

```text
initial capture with overscan
        |
        v
real WebGL glass visible
        |
        v
scroll starts
        |
        +--> keep WebGL visible
        |
        +--> adjust sampling by live scroll delta immediately
        |
        +--> asynchronously refresh backdrop at measured safe cadence
        |
        +--> when fresh texture arrives, swap/update seamlessly
        |
        v
scroll stops
        |
        +--> one final exact current capture if needed
        |
        v
real WebGL glass remains visible throughout
```

This should be tested before attempting extremely high-frequency full DOM screenshots.

---

# 7. Texture-coordinate correctness

Continuous mode must preserve the existing generation/freshness protections but extend them to distinguish:

```text
EXACT FRESH
texture corresponds exactly to current viewport

SCROLL-COMPENSATED
texture is older but still valid within known overscan and current scroll delta

INVALID
texture can no longer represent current viewport correctly
```

WebGL may remain visible for `SCROLL-COMPENSATED` only if the mapping is mathematically valid and bounded by captured source data.

Never label an arbitrary stale texture as compensated.

Track:

- capture scrollX/Y
- current scrollX/Y
- delta
- available overscan bounds
- exact/compensated/invalid status
- latest capture generation

---

# 8. Fixed/sticky and DOM mutation complications

Scroll translation is not globally uniform for all DOM content.

Audit at minimum:

- normal document-flow content
- `position: fixed`
- `position: sticky`
- transforms
- CSS animations
- videos/canvas/WebGL content
- route transitions
- DOM mutations during scroll

If some content cannot be represented correctly by UV translation, define clear invalidation rules.

The primary product use is fixed glass navigation over ordinary scrolling content, so optimize for that path first.

---

# 9. Device capability and stable fallback

Create a runtime capability decision based primarily on measured behavior.

Signals may include:

- WebGL2 availability
- frame timing
- capture engine timing
- texture upload timing
- device memory / hardware concurrency as initial hints only
- repeated long tasks
- memory pressure/context loss

Suggested policy:

```text
start conservative continuous-webgl test
        |
        v
measure actual device
        |
        +--> sustainable -> remain continuous-webgl
        |
        +--> not sustainable -> switch once to css-fallback
```

Do not repeatedly oscillate modes during scrolling.

Fallback must prioritize stability:

```text
CSS fallback at idle
CSS fallback during scroll
CSS fallback after scroll
```

---

# 10. Performance acceptance

For continuous WebGL mode, test on real or representative mobile hardware.

Required outcomes:

- no visible CSS/WebGL mode switch
- glass remains refractive during scroll
- scrolling remains responsive
- no sustained severe frame drops
- no browser tab crashes
- no WebGL context-loss loop
- no runaway memory growth
- no continuous capture backlog

Aim for smooth 60 Hz behavior where hardware supports it, but do not require every capture to run at 60 fps. WebGL can render at display refresh while backdrop updates happen less frequently if scroll compensation preserves visual correctness.

---

# 11. Visual acceptance

Use strong test content behind glass:

- very large typography
- concentric rings
- high-contrast lines
- saturated blocks

During continuous scrolling:

- those elements must move naturally under the glass
- refraction must remain visible
- no frozen backdrop sensation
- no obvious jumping when a new capture arrives
- no CSS-looking phase
- no stale wrong-position content

Fresh texture updates must blend/swap without a perceptible `chuck-chuck` transition.

---

# 12. Do not do these things

Do NOT satisfy this milestone by:

- styling CSS to imitate WebGL better
- retaining CSS as the normal scrolling presentation on capable devices
- simply hiding the transition with a longer fade
- running current ~90 ms html2canvas captures at high frequency
- removing real refraction during scroll
- sacrificing scroll responsiveness to keep WebGL visible
- permanently targeting only flagship devices without graceful fallback

---

# 13. Implementation order

1. Read `AGENTS.md`, `PERFORMANCE_PLAN.md`, `OPTICAL_TUNING.md`, and this file.
2. Preserve the current working WebGL shader and generation safeguards.
3. Add a capture-engine benchmark harness.
4. Benchmark current and plausible alternative capture engines.
5. Report measured results before choosing an engine.
6. Implement the fastest reliable engine behind an internal capture abstraction.
7. Prototype scroll-delta UV compensation using the current capture scroll origin.
8. Add overscan sufficient for compensated movement.
9. Keep WebGL visible throughout scroll in experimental continuous mode.
10. Refresh the texture at an empirically safe cadence.
11. Ensure fresh texture swaps are visually seamless.
12. Add exact/compensated/invalid source-state diagnostics.
13. Add runtime capability/performance downgrade to stable CSS fallback.
14. Test prolonged and aggressive mobile scrolling.
15. Verify no capture queue/memory/context-loss issues.
16. Run build/tests.
17. Update benchmark/docs with actual numbers and limitations.

If an experimental path fails, document why with measurements and try the next architecture rather than silently returning to temporary CSS-on-scroll.

---

# 14. Completion criteria

Milestone 4 is passed only if at least one tested capable Chromium device/browser configuration can:

- remain on WebGL glass at idle, during scroll, and after scroll
- show genuine moving refraction during scroll
- avoid visible rendering-mode transitions
- remain responsive and stable
- use bounded capture/update work

And the library must have a stable whole-session CSS fallback for hardware that cannot meet the continuous-WebGL performance envelope.

---

# 15. Completion report

When finished, report:

- capture engines benchmarked
- exact measured timing for each
- chosen capture engine/path and why
- whether scroll-delta UV compensation was implemented
- overscan strategy
- capture/update cadence during scroll
- avg/p95/worst frame timing
- memory/context-loss observations
- mobile viewport/device/browser tested
- continuous WebGL visual result
- fallback decision thresholds
- remaining browser limitations
