# Liquid Glass Performance Plan

## Status

Priority milestone: **remove scroll lag before further visual tuning**.

This plan is based on the current Chromium demo and the renderer currently committed to this repository.

Observed example from the demo:

- renderer: WebGL2
- quality: LOW
- WebGL program successfully linked
- fallback: false
- capture scale: approximately 0.35x
- captured source texture: approximately 161x277 in the observed mobile viewport
- capture duration: approximately 90 ms
- hundreds of captures accumulated during testing
- visible scroll jank remained severe

This tells us the WebGL shader is not the primary bottleneck. The expensive operation is repeated DOM rasterization with `html2canvas-pro`.

The goal of this milestone is therefore **not to make the shader cheaper**. The goal is to remove DOM capture from the interaction-critical path.

---

# 1. Required behavior

## 1.1 Hard invariant

During one continuous manual scroll gesture:

> **DOM captures started while scrolling = 0**

No exceptions for LOW/HIGH quality.

The browser must be free to perform normal scrolling without competing with repeated DOM cloning/rasterization.

## 1.2 Runtime state machine

Implement an explicit interaction state rather than allowing scroll events to directly invalidate the capture pipeline.

Suggested conceptual states:

```text
IDLE_WEBGL
    |
    | scroll/wheel/touch movement
    v
SCROLLING_LIGHTWEIGHT
    |
    | no relevant scroll event for 120-160 ms
    v
SETTLING
    |
    | exactly one capture
    v
REFRESHING
    |
    | texture upload + redraw
    v
IDLE_WEBGL
```

Names may differ, but behavior must remain equivalent.

---

# 2. Scroll-start behavior

On the first scroll event of a gesture:

1. mark interaction mode active
2. update surface rectangles as cheaply as necessary
3. cancel any scheduled-but-not-started capture timer
4. set `backdropDirty`/pending refresh state for after the gesture, but DO NOT capture now
5. switch the visible glass treatment to an interaction-safe presentation
6. keep listening for scroll position changes
7. restart the scroll-settle timer on each relevant scroll event

Do not call `invalidate("scroll")` if `invalidate()` can lead to capture scheduling during the gesture.

Do not maintain a requestAnimationFrame loop merely to keep trying to capture.

A frame loop during scroll is acceptable only if it performs cheap surface positioning/drawing and benchmarks well. It must not invoke DOM rasterization.

---

# 3. Interaction-safe glass presentation

Preferred first implementation: CSS glass during active scrolling.

For each registered surface while interaction mode is active:

```css
background: translucent tint;
backdrop-filter: blur(...) saturate(...);
-webkit-backdrop-filter: blur(...) saturate(...);
```

Requirements:

- no layout jump
- same border radius
- same element geometry
- normal DOM content remains unchanged
- transition should be subtle
- entering interaction mode must be very cheap

The WebGL canvas may be faded/hidden while scrolling if needed to avoid visibly stale refraction.

Alternative: freezing the last WebGL texture is allowed only if it looks acceptable and benchmarks better. Do not keep recapturing merely to make the frozen texture follow content.

Recommended transition duration: roughly 80-150 ms, subject to visual testing.

Do not animate expensive CSS properties continuously.

---

# 4. Scroll-settle behavior

Each relevant scroll event resets one settle timer.

Target initial debounce: **140 ms**.

Test within the 120-160 ms range.

When the timer fires:

1. verify scrolling really stopped
2. mark interaction mode inactive / settling
3. measure surface geometry
4. request exactly one backdrop capture
5. prevent duplicate capture requests from the same gesture
6. upload the resulting canvas to the existing WebGL texture
7. draw all visible surfaces
8. restore/fade in WebGL glass
9. clear the pending post-scroll refresh flag

If a DOM mutation or resize occurs during the same settle period, coalesce it into this one capture where possible.

---

# 5. Capture concurrency and coalescing

Current behavior includes `capturing`, `captureAgain`, `backdropDirty`, timers and invalidation flags. Simplify their semantics so they cannot create a capture train.

Required guarantees:

- maximum one active DOM capture at a time
- maximum one coalesced pending refresh after the active capture
- no unbounded `captureAgain` loop
- scroll events during an active capture do not queue one capture per event
- a gesture produces at most one post-scroll refresh unless a genuinely new visual invalidation occurs afterward

Consider replacing boolean interactions with explicit fields such as:

```ts
interactionMode: "idle" | "scrolling" | "settling"
pendingCaptureReason: string | null
captureInFlight: boolean
postCaptureRefreshPending: boolean
scrollGestureCaptureCount: number
```

Exact API is up to implementation quality.

---

# 6. Fix frame-performance measurement

The current renderer excludes sufficiently long frame intervals from its sample set. This hides severe stalls.

Remove logic equivalent to:

```ts
if (delta < 80) frameTimes.push(delta)
```

Long frames are precisely what the monitor needs to observe.

Track a bounded rolling window without dropping bad samples.

Add:

- `lastFrameMs`
- `averageFrameMs`
- `worstFrameMs`
- `p95FrameMs`
- FPS derived from an appropriate rolling statistic

Do not allow one idle tab/background interval to permanently poison the data. Visibility transitions may reset the rolling window, but interaction stalls must remain visible.

---

# 7. Capture-performance policy

The current adaptive system should distinguish visual quality from capture scheduling policy.

Suggested interpretation:

```text
capture < 25 ms
    dynamic refresh is relatively safe

25-40 ms
    occasional refresh only

40-60 ms
    idle-only capture

>60 ms
    strict idle-only capture
```

Even if hardware initially qualifies for HIGH quality, measured capture duration wins.

If capture cost is 90 ms, lowering shader sample count is not the primary response. The renderer should avoid capture during interaction.

Keep the existing shader quality tiers for GPU workload, but introduce a capture-policy concept if useful.

---

# 8. MutationObserver audit

Current mutation observation is intentionally broad. Audit it carefully.

Goals:

1. library-owned canvas/surface/debug mutations never trigger capture
2. CSS fallback/WebGL mode switching never triggers capture recursively
3. debug overlay updates never trigger capture
4. normal demo metrics updates never trigger capture
5. rapid React mutations collapse into one idle refresh
6. irrelevant mutations do not continuously rasterize the page

Continue excluding elements under:

- `[data-liquid-glass-surface]`
- `[data-liquid-glass-renderer]`
- `[data-liquid-glass-debug]`

But verify this is sufficient when attributes/classes are changed on ancestors or when React updates surrounding content.

Prefer a scheduled/coalesced idle invalidation instead of immediately making `backdropDirty` capture-eligible.

Potential future public API:

```ts
renderer.invalidate("known visual change")
```

This can allow applications to explicitly signal meaningful background changes rather than depending entirely on broad DOM observation.

Do not remove automatic invalidation entirely in this milestone unless necessary; make it safe first.

---

# 9. Demo cleanup

The normal demo must stop artificially creating a continuous workload.

Current demo includes a periodic pulse/update. Remove or disable it in the normal path.

Create an explicit optional stress-test mode if useful:

```text
Normal demo
- static content
- realistic header/footer
- obvious colorful content behind glass
- manual scroll

Stress demo
- periodic DOM mutation
- animated content
- resize testing
- forced invalidations
```

Debug overlays and pipeline controls must themselves be ignored by backdrop capture and mutation invalidation.

Debug should not default to production behavior when this library is consumed normally.

---

# 10. Diagnostics required for this milestone

Extend the existing diagnostics with:

```text
interaction mode: idle | scrolling | settling | refreshing
captures this scroll gesture: N
captures last 10 seconds: N
last capture: XX.X ms
average capture: XX.X ms (optional)
last frame: XX.X ms
average frame: XX.X ms
p95 frame: XX.X ms
worst frame: XX.X ms
pending capture: yes/no + reason
capture in flight: yes/no
```

Keep existing useful diagnostics:

- renderer mode
- quality tier
- WebGL version
- shader status
- source texture dimensions/status
- canvas/viewport dimensions
- DPR
- capture scale
- framebuffer status
- surface rect
- sampled UV
- last WebGL error

### Important validation indicator

While manually scrolling, this must remain:

```text
captures this scroll gesture: 0
```

If it increments, the milestone fails.

---

# 11. Acceptance tests

Do not declare this task complete merely because TypeScript builds.

## Test A - slow continuous scroll

- open Chromium demo
- begin slowly scrolling for at least 5 seconds
- observe glass header/footer
- confirm normal content tracks input smoothly
- confirm zero captures start during gesture
- stop scrolling
- confirm exactly one capture occurs after settle debounce
- confirm WebGL glass returns/refreshes

PASS requires zero capture during the active gesture.

## Test B - aggressive scroll

- rapidly scroll up/down for 5-10 seconds
- no DOM capture during active movement
- no growing capture queue
- one coalesced refresh after final settle
- no multi-second catch-up sequence

## Test C - repeated short gestures

Perform several small scrolls separated by pauses.

Each gesture should produce at most one post-settle refresh.

## Test D - mutation while idle

Change relevant page content while idle.

Expected: one coalesced refresh, not repeated capture loops.

## Test E - mutation while scrolling

Trigger a relevant mutation during active scrolling.

Expected: mark refresh pending but do not capture until scrolling settles. Coalesce into post-scroll capture.

## Test F - resize

Resize viewport continuously.

Do not perform expensive repeated captures for every resize event. Use cheap geometry/canvas updates during interaction and one settled capture.

## Test G - WebGL fallback

Force WebGL unavailable/failure.

CSS glass should remain usable and page interaction must stay smooth.

## Test H - no debug mode

Run normal demo/library without debug overlay and stress mutation. Verify behavior remains correct.

---

# 12. Success criteria

The milestone is successful only when all of these are true:

- manual scrolling no longer feels severely laggy
- zero DOM captures start during active continuous scroll
- one capture occurs after scroll settles
- no capture backlog builds
- WebGL refraction remains intact when idle
- Chromium still displays genuine refraction/distortion
- normal DOM remains interactive and accessible
- CSS fallback handles interaction periods gracefully
- mutation handling cannot cause self-sustaining capture loops
- long frames are measured rather than discarded
- TypeScript/build/tests pass

Visual glass quality may temporarily decrease during motion. That is intentional. Interaction performance has priority.

---

# 13. Do not do these things

Do NOT attempt to solve this milestone primarily by:

- reducing capture scale from 0.35 to an even blurrier value
- removing refraction from the shader
- reducing everything to CSS blur permanently
- creating multiple WebGL canvases
- capturing once per glass surface
- repeatedly rasterizing `document.documentElement` during scroll
- adding more requestAnimationFrame loops without profiling
- hiding long frames from metrics
- adding arbitrary timeouts that still permit repeated captures

The measured bottleneck is DOM capture frequency and scheduling.

---

# 14. Secondary optimization after zero-capture scrolling works

Only after the primary milestone passes, benchmark whether capture itself can be reduced further.

Potential investigation: **backdrop-zone capture**.

For fixed header/footer use cases, only regions behind those surfaces matter visually. Explore whether capturing/rasterizing only required viewport zones plus overscan can reduce cost.

Example:

```text
viewport
+--------------------------+
| HEADER CAPTURE ZONE      |
| + overscan               |
+--------------------------+
|                          |
| no glass sampling here   |
|                          |
+--------------------------+
| FOOTER CAPTURE ZONE      |
| + overscan               |
+--------------------------+
```

Important: cropping the output of `html2canvas` may not significantly reduce DOM traversal/layout cost. Benchmark before adopting this architecture.

Do not complicate the implementation with zone capture until the zero-capture-during-scroll milestone is working.

---

# 15. Longer-term architecture consideration

Arbitrary live DOM cannot be cheaply sampled as a true GPU backdrop in every browser because browsers do not expose the already-composited webpage as a general WebGL texture.

Therefore the sustainable cross-browser design is hybrid:

```text
IDLE
DOM -> occasional capture -> shared WebGL texture -> true refractive glass

INTERACTION
normal DOM -> native scrolling
           -> lightweight CSS glass / frozen WebGL presentation

SETTLED
one fresh DOM capture -> texture upload -> WebGL refraction resumes
```

This is an intentional architecture, not a temporary hack.

The renderer should make this transition difficult for a normal user to notice.

---

# 16. Implementation order for Codex

Execute in this order:

1. Read `AGENTS.md` and this file completely.
2. Inspect current `GlassRenderer`, capture manager, provider, surface styling, demo and performance tests.
3. Record current behavior and identify every path that can call `captureViewport()`.
4. Introduce explicit interaction/capture scheduling state.
5. Enforce zero capture during scroll.
6. Add lightweight interaction glass mode.
7. Add one post-scroll capture after ~140 ms settle.
8. Fix capture concurrency/coalescing.
9. Fix long-frame metrics.
10. Add scroll/capture diagnostics.
11. Audit MutationObserver invalidation.
12. Remove normal-demo pulse/stress mutation.
13. Add/update unit tests for scheduling invariants where practical.
14. Build/typecheck/test.
15. Run the demo and manually verify the acceptance tests.
16. Only after performance passes, make minor visual transition adjustments if necessary.

Do not stop after writing a design or TODO. Implement the milestone.

When finished, summarize:

- files changed
- old capture behavior
- new capture behavior
- measured capture count during scroll
- measured capture duration
- measured frame/p95/worst timing if available
- any remaining source of jank
- browser(s) actually tested
