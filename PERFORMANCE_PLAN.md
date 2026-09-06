# Liquid Glass Performance Plan

## Status

### Milestone 1 — scroll jank: PASSED in Chromium

The zero-capture-during-scroll architecture has now been implemented and manually tested. Observed after implementation:

- scrolling is subjectively smooth
- `captures this scroll gesture: 0` during active scrolling
- frame timing during scroll approximately 8.3 ms average, p95 approximately 8.9–9.3 ms, worst approximately 16.7–17.4 ms in the observed run
- WebGL2 remains active at HIGH quality
- DOM capture still costs roughly 90–111 ms
- capture policy correctly reports `strict-idle-only`
- one settled capture occurs after the interaction rather than repeated capture work during the gesture

This validates the hybrid architecture: expensive DOM capture must stay outside the interaction-critical path.

### Milestone 2 — post-scroll stale-texture distortion: PASSED in Chromium

The stale-texture bug was fixed with independent viewport, capture, texture-upload, and completed-draw generations. Any invalidation immediately makes the previous WebGL texture ineligible for presentation; CSS remains active until a current-generation capture has uploaded and drawn while the scheduler is fully idle. Obsolete captures are discarded and leave one coalesced refresh pending for the newest generation.

The scheduler and generation contract remain mandatory guardrails. Current verification measurements are recorded in `BENCHMARK.md`.

---

# 1. Confirmed root cause of the historical bug

The former transition exposed WebGL too early.

The renderer does this at scroll settle:

1. `captureScheduler.settle()` changes the scheduler to `settling`
2. `setInteractionPresentation(false)` is called immediately when the mode is not `idle`
3. this restores the WebGL canvas opacity before the fresh post-scroll DOM capture has completed
4. the WebGL texture still represents the previous viewport position
5. the shader samples that stale texture using rectangles/UVs measured for the new viewport position
6. the stale source is therefore refracted as if it were current, producing the large duplicated/stretched content visible in the screenshot
7. only later does the ~90 ms capture finish and upload the correct texture

The code path to inspect first is `restartInteractionSettleTimer()` in `src/renderer/GlassRenderer.ts`.

The former logic effectively did:

```ts
captureScheduler.settle();
...
if (interactionMode !== "idle") setInteractionPresentation(false);
```

That is unsafe. `settling` means a refresh is still pending. It does **not** mean the existing WebGL texture matches the current viewport.

The library must never show a stale texture using current-viewport UV coordinates.

---

# 2. Required invariant: texture freshness

Introduce an explicit freshness concept.

At all times the renderer must know whether the current WebGL backdrop texture corresponds to the current settled viewport state.

Conceptually:

```text
textureFresh = true
    idle WebGL is safe to display

scroll starts
    textureFresh = false
    hide WebGL / show interaction CSS

scrolling
    textureFresh = false
    zero captures

scroll settles
    textureFresh = false
    KEEP CSS PRESENTATION ACTIVE
    start one capture

capture completes successfully
    upload texture
    draw using current surface geometry
    textureFresh = true
    only now reveal WebGL
```

The exact field name may differ, but this invariant must be explicit and testable.

---

# 3. Correct settle transition

Change the state flow to:

```text
IDLE_WEBGL_FRESH
      |
      | scroll begins
      v
SCROLLING_CSS
      |
      | scroll stops ~140 ms
      v
SETTLING_CSS
      |
      | fresh capture starts
      v
REFRESHING_CSS
      |
      | capture succeeds + texture uploaded + draw completes
      v
IDLE_WEBGL_FRESH
```

Important:

**CSS glass must remain visible throughout `settling` and `refreshing`.**

Do not reveal the WebGL canvas merely because active scroll events stopped.

The ~90 ms capture should happen behind the CSS presentation. Once the fresh texture is uploaded and rendered, crossfade to WebGL.

---

# 4. Where WebGL may become visible

The normal WebGL presentation may be restored only when all of these are true:

- interaction mode is effectively idle
- no capture is in flight
- no required settled capture is pending
- the most recent required capture succeeded
- the texture is marked fresh for the current viewport/scroll generation
- current surface rectangles have been measured
- one draw has completed using that fresh texture

Do not call `setInteractionPresentation(false)` earlier than this.

Specifically audit and remove/replace premature calls in:

- `restartInteractionSettleTimer()`
- `capture()` / `finally`
- quality changes
- mutation/resize paths
- any scheduler transition that can move from scrolling to settling

---

# 5. Use generations to prevent race conditions

A boolean freshness flag may be sufficient initially, but a generation counter is safer.

Recommended model:

```ts
viewportGeneration: number
textureGeneration: number
```

Increment `viewportGeneration` whenever the backdrop becomes stale because of:

- actual scroll position change
- resize
- relevant DOM mutation
- route/content invalidation

When capture begins, record:

```ts
const captureGeneration = viewportGeneration;
```

After the asynchronous DOM capture returns:

- if `captureGeneration !== viewportGeneration`, the result is stale
- do not reveal it as current glass
- it may be discarded, or uploaded only if useful internally, but it must not mark the texture fresh
- ensure one coalesced fresh capture remains pending for the latest generation

On a successful current-generation upload:

```ts
textureGeneration = captureGeneration;
```

WebGL may be revealed only when:

```ts
textureGeneration === viewportGeneration
```

This protects against the user starting another scroll while the previous 90 ms capture is still resolving.

---

# 6. Critical race: user scrolls again during post-scroll capture

Test this deliberately.

Sequence:

```text
scroll
stop
capture begins
before capture finishes -> scroll again
```

Expected behavior:

- CSS glass remains visible
- second scroll remains smooth
- old capture result must not flash onto screen
- old capture must not mark texture fresh
- no capture begins during the second active scroll
- after the second scroll settles, exactly one current-generation capture refreshes the texture
- only then WebGL returns

This is essential because capture duration is around 90–110 ms, long enough for users to resume interaction before it finishes.

---

# 7. Capture failure behavior

If a settled capture fails, produces an invalid/empty source, loses WebGL, or throws:

- do not reveal stale WebGL
- keep CSS glass active
- keep the page fully usable
- mark the texture stale
- retry only according to a conservative idle policy; do not create a loop

Correctness is more important than briefly restoring refraction.

---

# 8. Transition behavior

Once the new texture is valid and a draw has completed:

- crossfade CSS -> WebGL subtly
- target approximately 80–120 ms
- avoid a moment where both layers visually compound into excessive blur/opacity
- avoid layout/style mutation that itself triggers a new backdrop capture

The user should perceive:

```text
scrolling: smooth lightweight glass
stop: same stable-looking lightweight glass for ~capture duration
fresh refractive glass quietly resolves into place
```

They must never see the previous viewport refracted at the new scroll position.

---

# 9. Diagnostics to add

Add enough diagnostics to prove the freshness contract:

```text
texture freshness: fresh | stale
viewport generation: N
texture generation: N
capture generation: N or none
webgl presentation: visible | hidden
```

During scrolling and settled capture:

```text
texture freshness: stale
webgl presentation: hidden
```

After successful current-generation upload/draw:

```text
texture freshness: fresh
viewport generation == texture generation
webgl presentation: visible
```

---

# 10. Regression requirements from Milestone 1

These are non-negotiable while fixing stale-texture distortion:

- zero DOM captures during active continuous scrolling
- no capture backlog
- no repeated html2canvas calls during scrolling
- CSS interaction mode remains cheap
- long frame metrics remain measured
- WebGL2 genuine refraction remains intact when fresh/idle
- one shared WebGL2 renderer
- normal DOM remains accessible and interactive

Do not solve the distortion by returning to continuous capture.

---

# 11. Acceptance tests for Milestone 2

## Test A — stop at random positions

Repeatedly scroll and stop at at least 10 arbitrary positions containing visually distinct text/shapes.

PASS:

- no duplicated old typography
- no stretched old shapes
- no wrong previous-scroll content inside glass
- CSS presentation remains until fresh texture is ready
- WebGL returns only with correct current backdrop

## Test B — slow scroll then stop

Slowly move content beneath the header and stop with high-contrast text partially behind the glass.

PASS: the final refracted text corresponds exactly to the current content position.

## Test C — fast flick then stop

Fast scroll/flick and stop abruptly.

PASS: no stale texture flash during the ~90–110 ms refresh.

## Test D — resume before capture completes

Scroll, stop, then begin scrolling again within ~50 ms.

PASS: stale first capture is never revealed; second interaction remains smooth; one fresh capture occurs after final settle.

## Test E — repeated stop/start

Perform 10 quick stop/start gestures.

PASS: no capture train, no stale flashes, no generation mismatch shown as WebGL.

## Test F — resize and stop

Resize viewport and stop.

PASS: CSS remains until a texture for the new dimensions is uploaded and drawn.

## Test G — DOM mutation while stale

Stop scrolling, then mutate relevant content before the pending capture completes.

PASS: obsolete capture does not become visible; latest generation wins.

---

# 12. Previous Milestone 1 architecture (retain)

DOM rasterization remains expensive. The sustainable cross-browser design is hybrid:

```text
IDLE + FRESH
DOM -> occasional capture -> shared WebGL texture -> true refractive glass

INTERACTION / STALE
normal DOM -> native scrolling
           -> lightweight CSS glass

SETTLED BUT STILL STALE
CSS glass stays visible
-> one DOM capture happens behind it
-> texture upload
-> current-generation draw

FRESH AGAIN
crossfade -> WebGL refraction
```

The shader is not the current bottleneck. Do not weaken it to fix scheduling correctness.

---

# 13. Performance policy retained

Capture timing guidance:

```text
<25 ms     dynamic refresh potentially safe
25-40 ms   occasional refresh
40-60 ms   idle-only
>60 ms     strict-idle-only
```

The observed ~90–111 ms capture cost remains `strict-idle-only`.

---

# 14. Mutation and demo rules retained

- library-owned canvas/surface/debug mutations must not trigger capture
- coalesce mutations aggressively
- automatic stress/pulse mutation belongs behind an explicit stress mode
- debug overlay must not contaminate capture or trigger invalidation
- normal demo should represent realistic usage

---

# 15. Implementation order for Codex now

1. Read `AGENTS.md` and this updated file completely.
2. Preserve the successful zero-capture scrolling implementation.
3. Inspect `restartInteractionSettleTimer()`, `setInteractionPresentation()`, `capture()`, `CaptureScheduler`, and all paths that reveal WebGL.
4. Reproduce the stale-texture bug by stopping at arbitrary scroll positions.
5. Implement explicit texture freshness, preferably with viewport/texture generations.
6. Keep CSS presentation active through settling and refreshing.
7. Reveal WebGL only after a successful current-generation texture upload and draw.
8. Handle scroll-again-during-capture race safely.
9. Handle failed/obsolete captures without stale flashes.
10. Add freshness/generation diagnostics.
11. Add scheduler/renderer tests for stale generation behavior where practical.
12. Run TypeScript/unit/build validation.
13. Manually execute Milestone 2 acceptance tests in Chromium.
14. Confirm Milestone 1 remains passed.
15. Do not tune shader appearance until this correctness bug is resolved.

When finished report:

- confirmed root cause
- files changed
- exact freshness/generation mechanism
- whether any stale capture can still become visible
- captures during active scroll
- capture duration
- frame average/p95/worst during scroll
- results of random-stop and resume-during-capture tests
- browsers actually tested

---

# 16. Longer-term optimization after correctness

Once both smooth scrolling and texture freshness are stable, benchmark backdrop-zone capture for fixed headers/footers. Do not begin that optimization until this bug is fixed. Cropping output may not reduce DOM traversal cost, so benchmark before changing architecture.
