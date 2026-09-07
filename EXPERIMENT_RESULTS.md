# Experiment evaluation — `mvp/lens-local-capture`

Date: 2026-09-07

## 1. Branch and commit tested

- Branch: `mvp/lens-local-capture`
- Commit: `a02787e82825c6e108aa5893474d4982ca57460a`
- The branch worktree already contained uncommitted standardized-fixture and measurement changes when evaluation began. They were preserved and tested as-is; the pre-report diff SHA-256 was `20bd36883f16ef85604ff39f5aa4ae91e37fae26d7bfa28544460c24636f33d2`.
- No architecture change or optimization was made during evaluation.

## 2. Environment, URL, and test conditions

- Machine: local macOS workstation
- Browser: Chromium, WebGL 2.0 (`OpenGL ES 3.0 Chromium`); the existing branch measurement record identifies Chrome 152
- URL: `http://127.0.0.1:4175/?debug`
- Vite port: `4175`
- Viewport: 1200×909 CSS px
- DPR: 2.00
- Canvas: 2400×1818 px
- Quality/capture scale: HIGH / 0.75
- Test sequence: initial load; normal and exaggerated optical views; short manual scroll; automated continuous scroll through 2,211 px while FAQ progress ran; settle; FAQ expand/collapse; one timed 4-second FAQ transition positioned beneath the fixed header; controlled mutation samples

This was a single-branch run. No other experiment server was benchmarked concurrently.

## 3. Correctness gate

| Check | Result | Evidence |
| --- | --- | --- |
| Genuine nonlinear refraction/warping visible | PASS | Normal mode visibly displaced high-contrast content; exaggerated mode made curved nonlinear displacement unambiguous. This was not blur-only output. |
| Correct underlying content sampled/rendered | PASS while source is valid | Header refraction matched typography, rings, FAQ row, and high-contrast lines beneath it in exact and scroll-compensated states. |
| No obvious stale/frozen backdrop during normal interaction | PASS | Generation/source-state protection did not present an invalid texture as current. Invalid data was hidden. |
| Scrolling remains visually correct | **FAIL** | A short scroll remained `scroll-compensated`, but the 318 px vertical overscan was exhausted during the continuous-scroll workload. At 1,529 px delta the state was `invalid`, texture `stale`, and `webgl presentation: hidden` until settle/recapture. |
| FAQ question changes every 4 seconds | PASS | Observed sequential 1/3 → 2/3 and 2/3 → 3/3 transitions across 4.2-second checkpoints. |
| Progress bar animates continuously and resets | PASS | CSS animation `delivery-faq-fill` was active; sampled transform scale changed from 0.768529 to 0.0229462 across a reset. |
| Expand/collapse represented correctly | PASS | Expanded DOM became visible and the exact backdrop was recaptured; collapse restored the timed compact row. |
| No major clipping/layout duplication/flicker | **FAIL** | Layout and valid-source rendering did not duplicate or clip, but the deliberate WebGL hide after overscan exhaustion is a visible WebGL → non-WebGL → WebGL presentation transition. |
| No fatal console errors | PASS | No warning or error entries were recorded during the run; renderer reported `WebGL/last error: none`. |

The approach fails the correctness gate because it cannot maintain continuous real WebGL over the standardized continuous-scroll distance.

## 4. Measurements

Measured values below come from the debug instrumentation during this run. Capture percentiles are directional: the UI exposes the latest sample rather than a downloadable history, so the pooled capture set consists of seven observed checkpoints across initialization, scrolling, FAQ mutation, expand/collapse, and controlled mutation (`n=7`).

| Metric | Measured result | Notes |
| --- | ---: | --- |
| Initialization / first capture | 143.4 ms | 15.1 ms traversal, 123.2 ms raster, 4.7 ms bitmap preparation, 1.5 ms upload |
| Continuous-scroll frame average | 8.3 ms | Measured at the active-scroll checkpoint |
| Continuous-scroll frame p95 | 9.2 ms | The source was already invalid and WebGL hidden at this checkpoint, so this cannot count as a successful WebGL performance result |
| Continuous-scroll worst frame | 9.4 ms | Same qualification as above |
| Visible dropped/janky frames | Presentation failure observed | The material disappearance/mode transition after overscan exhaustion was more important than rAF cadence |
| FAQ/state-change latency to correct source | approximately 102 ms capture wall time | The transition beneath glass caused one capture; correctness was present at the 4.2-second checkpoint. End-to-end mutation-to-presentation latency was not separately timestamped. |
| Capture total median / observed p95 | 104.0 / 143.4 ms | Directional pooled checkpoints, `n=7` |
| Raster median / observed p95 | 90.9 / 123.2 ms | Dominant stage; crop did not remove document-root cloning/style/raster cost |
| GPU upload median / observed p95 | 0.8 / 2.3 ms | Upload was not the bottleneck |
| Captures/uploads during active continuous scroll | 0 / 0 | `strict-idle-only`; one capture/upload occurred after scroll settled |
| Captures/uploads during one 4-second progress cycle | 1 / 1 when the question changed | The CSS progress animation itself caused no per-frame capture. Its React question transition caused one DOM-mutation capture when positioned beneath glass. |
| Capture backlog | At most one in flight; no accumulating queue observed | A pending settled capture was recorded during active scroll |
| Lens-local texture | 733×582 (1,706,424 bytes) or 733×1158 (3,395,256 bytes) | Height depended on surface/content position and crop bounds |
| Canvas | 2400×1818 | Shared renderer canvas at DPR 2 |
| CPU observation | Main-thread capture stalls remain material | Capture wall time was approximately 96–143 ms; no OS-level CPU percentage was collected |
| Runtime/dependency overhead | `html2canvas-pro` installation occupied approximately 4.9 MiB | Disk size is not bundle gzip size; no production bundle delta was generated |

The branch's earlier A/B record (`MVP_LENS_LOCAL_CAPTURE_RESULTS.md`) measured viewport capture at 900×4772 / 17.18 MB versus lens-local at up to 733×1158 / 3.40 MB, while total capture remained about 102–111 ms. The current evaluation reproduced the same conclusion: output texture/upload cost drops substantially, but acquisition wall time remains high.

## 5. Architecture facts

- **DOM screenshot/rasterization:** Yes. `html2canvas-pro` captures `document.documentElement`; lens-local bounds reduce the requested output region but do not avoid document cloning, style collection, and rasterization.
- **CPU→GPU transfer:** Yes, after each accepted capture. The raster canvas is converted with `createImageBitmap()` where available and uploaded with `texSubImage2D`/`texImage2D`.
- **Scrolling behavior:** Short deltas primarily adjust retained source coordinates with mathematically bounded scroll compensation. Active scroll does not recapture. Once the delta exceeds 0.35 viewport (318 px here), the source becomes invalid and WebGL is hidden until an idle capture completes.
- **Continuous progress animation:** The bar is a compositor-friendly CSS animation and does not trigger capture every frame. The question/state transition triggers a DOM-mutation capture.
- **GPU retention:** The current cropped backdrop texture and reusable WebGL programs/buffers are retained GPU-side. The DOM scene itself is not retained as a GPU scene graph.
- **Content/CSS limits:** Subject to `html2canvas-pro` fidelity limitations; browser-native/video/canvas/complex CSS and cross-origin resources may be incomplete or tainted/blocked depending on source and CORS policy.
- **DOM duplication/rearrangement:** No consumer DOM rearrangement or wrapping is required, but the capture engine internally clones the document for rasterization.
- **Browser/API restrictions:** Requires WebGL2 for real glass and depends on browser support/behavior for DOM rasterization and `createImageBitmap` optimization. CSS is the stable fallback when WebGL is unavailable/unsafe.
- **Cross-origin/security:** No cross-origin failure occurred in this local fixture. Real remote images/fonts require CORS-safe capture or will be omitted/fail according to browser and capture-engine rules.
- **Implementation/runtime complexity:** Moderate-to-high. It preserves one shared renderer and source-generation correctness, but adds crop planning, surface union/guard bounds, overscan accounting, exact/compensated/invalid mapping, mutation invalidation, async race rejection, bitmap preparation, and texture upload instrumentation.

## 6. Visual assessment

- **Refraction strength/shape:** Strong, genuine curved displacement in normal mode; exaggerated debug mode clearly demonstrated nonlinear warping.
- **Edge/specular quality:** Clean rounded highlight/specular boundary and close to the known-good MVP because shader/material calibration is preserved.
- **Blur/scattering/chromatic behavior:** Present and visually convincing on valid captures; high-contrast rings and rules exposed refraction rather than mere transparency.
- **Temporal stability during short scroll:** Stable while scroll compensation remained inside overscan.
- **Temporal stability during long scroll:** Unacceptable. The source crossed from compensated to invalid, WebGL presentation became hidden, and it returned only after a roughly 104 ms settled capture.
- **Temporal stability during progress/state change:** CSS progress itself stayed smooth and did not cause per-frame rasterization. The 4-second question transition was reflected after one approximately 102 ms capture, creating a potential capture stall but no stale presentation.

The optical material is good enough for evaluation; the failure is the source architecture under sustained scroll, not missing final shader calibration.

## 7. Result classification

**FAIL**

Lens-local capture materially reduces texture memory and GPU upload cost, but it does not remove the dominant document-root capture work and cannot preserve continuous WebGL beyond a small overscan window. The standardized continuous-scroll workload therefore violates the core correctness requirement before its low active-scroll frame times can be considered competitive.

## 8. Biggest advantage and blocker

- **Biggest advantage:** Approximately 80–90% lower texture area/storage than the prior full-viewport overscan capture, with sub-millisecond typical GPU upload and preserved optical quality.
- **Biggest blocker:** `html2canvas-pro` still performs expensive document-root cloning/style/raster work, while finite local overscan forces WebGL to disappear during an ordinary long scroll.

## 9. Recommendation

Advance to real Delivery Market test: **NO**.

Do not spend Stage B integration effort on this branch. Preserve its crop/upload findings for a source architecture that avoids full document cloning and can keep a valid retained/camera representation throughout sustained scrolling.
