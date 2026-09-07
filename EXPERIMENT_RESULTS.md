# Experiment Results — SVG Live DOM

## 1. Branch and commit tested

- Branch: `poc/svg-live-dom`
- Commit: `d685322122a3c315de10eabeff5a6f815ec2e938` (`Add SVG live DOM MVP spec`)
- Tested working state: the commit above plus the pre-existing uncommitted MVP fixture changes in `MVP_SVG_LIVE_DOM.md`, `examples/DeliveryMarketFaqFixture.tsx`, `examples/demo.css`, and `examples/main.tsx`.
- Evaluation protocol: `EXPERIMENT_EVALUATION.md` fetched and read from `origin/main` on 2026-09-07.

## 2. Environment

- Machine: Apple M1 Pro, 16 GiB RAM
- OS: macOS 26.6.1 (build 25G76)
- Browser: Chromium 151.0.0.0 (Codex in-app browser)
- Viewport: 1280 × 720 CSS px
- DPR: 2
- URL/port: `http://127.0.0.1:4179/`
- Server: Vite 7.3.6 development server, branch run individually
- Measurement sequence: 12.0 seconds of continuous requestAnimationFrame-driven bidirectional scrolling across the 2,195 CSS-px document while the 4-second FAQ progress animation and automatic question changes continued. Manual/visual checks covered the hero, high-contrast stripe field, FAQ state, and expand/collapse.

## 3. Correctness gate

| Check | Result | Evidence |
|---|---|---|
| Genuine nonlinear refraction/warping visible | PASS | The 58 px `feDisplacementMap` produced obvious nonlinear bends in large type, ring edges, vertical stripes, and the rotated stripe-field label. This was visibly more than blur/transparency. |
| Correct underlying content sampled/rendered | PASS for the standardized fixture | The lens rendered a synchronized duplicate of the controlled content subtree at the matching scroll coordinate. It does **not** sample arbitrary underlying page pixels; this is the central architecture blocker. |
| No obvious stale/frozen backdrop during normal interaction | PASS | The duplicated subtree remained live during scrolling, FAQ timer changes, progress animation, and expand/collapse. |
| Scrolling remains visually correct | PASS | The fixed lens stayed in place while its mirrored subtree tracked document scroll every animation frame; no visible jumps or frozen frames were observed in the tested sequence. |
| FAQ question changes every 4 seconds | PASS | Both ordinary and mirrored copies advanced together; sampled text changed from question 3 to question 1 across a 4.3-second observation. |
| Progress bar continuously animates and resets | PASS | Both copies reported matching intermediate transforms. Observed scale values changed from 0.7666 to 0.2293 across a timer reset, then advanced to 0.8646. |
| Expand/collapse represented correctly | PASS | Opening produced two synchronized expanded panels with six rendered item nodes total (three per copy); closing removed both panels. |
| No major clipping/layout duplication/flicker | PASS for the fixture | Lens clipping was stable and the duplicate aligned for the controlled full-width layout. DOM duplication is intentional here and remains a product-level constraint. |
| No fatal console errors | PASS | No browser warnings or errors were recorded during the checks. |

## 4. Measurements

Measured values below come from temporary lightweight instrumentation added only for the evaluation and removed afterward.

| Metric | Result | Notes |
|---|---:|---|
| Local navigation/startup duration | 31.2 ms | Navigation Timing duration on the Vite dev URL; not a production cold-load benchmark. |
| Continuous-scroll duration | 12,005.9 ms | Bidirectional full-range scroll with FAQ animation active. |
| Frames sampled | 1,441 | Display cadence was approximately 120 Hz. |
| Average frame time | 8.33 ms | Measured requestAnimationFrame interval, including all frames; no filtering. |
| Frame p95 | 9.20 ms | Measured. |
| Worst frame | 17.40 ms | Measured. |
| Frames over 20 ms | 0 | Measured. |
| Frames over 50 ms | 0 | Measured. |
| Long tasks | 0 | No Long Tasks API entries during the 12-second run. |
| Visible dropped/janky frames | 0 observed | Visual observation, not a compositor trace. |
| FAQ/state-change latency | Within the next observed render; exact latency N/A | Both copies were synchronized when sampled. No dedicated event-to-paint trace was built under the lightweight-instrumentation guardrail. |
| DOM capture/rasterization median/p95 | N/A | No DOM screenshot/capture path is used. Browser-native painting of duplicated DOM still occurs. |
| GPU upload median/p95 | N/A | The experiment creates no application-managed texture upload path. |
| Capture/upload count during active scrolling | 0 / 0 | No capture or application-managed upload. |
| Capture/upload count per 4-second progress cycle | 0 / 0 | Progress is a CSS transform animation in each DOM copy. |
| Texture/canvas dimensions and bytes | N/A | No texture or canvas is created by the experiment. |
| CPU usage | N/A | No reliable process-level CPU trace was available in the lightweight run. |
| Production demo bundle | 199.16 kB JS / 62.64 kB gzip; 6.42 kB CSS / 2.19 kB gzip | Whole demo output, not incremental architecture cost. No new dependency was added for the SVG technique. |

`npm run demo:build` and `npm run build` both completed successfully. The production demo build transformed 29 modules in 531 ms.

## 5. Architecture facts

- DOM screenshot/rasterization: no explicit screenshot library is used. The browser paints the ordinary content and a second filtered DOM subtree.
- CPU→GPU pixel transfer: no application-managed repeated transfer. Browser-internal compositing behavior is implementation-defined.
- Scroll behavior: scrolling updates a CSS custom property once per animation frame and translates the retained mirrored DOM subtree. It does not trigger explicit reconstruction or capture.
- Progress animation behavior: the progress bar is duplicated and animated by CSS in both subtrees. It does not trigger capture or upload work every frame.
- GPU retention: there are no application-managed GPU scene objects or textures. The browser may promote/filter layers internally, but that is not controlled or guaranteed by this architecture.
- Content/CSS representation limits: SVG `filter` filters the element's own rendered subtree. It cannot refract unrelated arbitrary DOM merely because that DOM is visually behind a fixed lens. Cross-subtree blending/backdrop acquisition is not provided.
- DOM requirements: the page content must be wrapped inside the filtered subtree or duplicated and kept synchronized. This MVP duplicates the full controlled content tree, lifts timer/expanded state, marks the mirror `aria-hidden`, and makes it non-interactive.
- Duplication consequences: layout width, fonts, responsive variants, scroll coordinates, identity, local component state, media, focus, form state, accessibility, and side effects must all remain synchronized. Components with internal state or external effects cannot be safely duplicated without architectural changes.
- Browser/API restrictions: relies on SVG filters (`feTurbulence`, `feDisplacementMap`, blur/color matrix), CSS transforms, and browser-specific filter/compositor behavior. Only Chromium was tested in this evaluation.
- Cross-origin/security constraints: none encountered in this fixture. Unlike screenshot capture, no canvas-tainting boundary was exercised; duplicated cross-origin embedded content may still have independent rendering/interaction limitations.
- Complexity: the visual primitive is small, but making an arbitrary real application duplicable is high-complexity and invasive. It changes page/component ownership rather than acting as a reusable backdrop layer.

## 6. Visual assessment

- Refraction strength/shape: strong, unmistakable nonlinear displacement at the default 58 px scale. High-contrast stripes and large typography bend clearly.
- Edge/specular quality: a crisp rounded lens outline, inset highlight, and broad translucent shine provide a readable glass boundary, but edge optics are decorative rather than physically derived.
- Blur/scattering/chromatic behavior: 1.6 px Gaussian blur plus a turbulence-based frost overlay gives a heavily frosted result. There is no chromatic aberration and no calibrated scattering/transmission model.
- Comparison with the known-good WebGL MVP: the SVG result proves live warping, but is substantially more distorted/frosted and less optically calibrated. It does not reproduce the existing material's edge-normal behavior or subtle refraction profile.
- Temporal stability during scroll: excellent in the controlled fixture. The duplicate follows scroll via retained transform with no capture delay.
- Temporal stability during progress/state change: excellent for shared lifted state and duplicated CSS animation; both copies remained visually synchronized in the checks.

Missing final optical calibration is not the reason for rejection. The decisive issue is that the browser primitive cannot refract arbitrary sibling/background DOM.

## 7. Result classification

**FAIL**

The standardized fixture is correct and fast, but the technique does not solve the product's backdrop-acquisition problem. It replaces arbitrary backdrop refraction with a synchronized duplicate of the application DOM. Applying it to the real Delivery Market header/footer would require invasive wrapping or duplication and synchronization of the real page, responsive variants, state, media, and interactions. Those compromises are unacceptable for a reusable glass renderer.

## 8. Biggest advantage and blocker

- Biggest advantage: continuously live nonlinear warping with zero explicit capture, zero application-managed texture upload, and excellent measured scroll cadence.
- Biggest blocker: SVG filters cannot sample unrelated DOM behind the glass; correct output requires wrapping or duplicating the content to be refracted.

## 9. Recommendation

Advance to real Delivery Market test: **NO**.

The controlled result is sufficient to establish both feasibility for explicitly owned/duplicated content and failure as a general fixed-glass backdrop architecture. Per the evaluation stop rule, further integration or optimization is not justified.

## 10. Follow-up implementation (2026-09-08)

At the user's direction, the branch was advanced beyond the original stop rule
for an opt-in Delivery Market trial. `SvgLiveDomProvider` now clones the live
provider DOM once rather than mounting a second React tree, incrementally
synchronizes mutations and form state, strips duplicate identity/accessibility
references, and uses one viewport-sized filtered layer clipped across all
visible glass surfaces.

On the local Delivery Market page, its initial mirror of 2,319 nodes took
41.7–63.9 ms across observed reloads. A mobile repeated-scroll sample reported
0.45 ms average mirror alignment/surface-measurement work, no rebuilds, and two
correctly detected header/footer surfaces. The dynamic mobile FAQ sheet also
opened and closed without recursive mirroring or console errors. These results
remove the second-React-tree/state-duplication blocker for this integration,
but they do not remove the browser-level duplicate DOM/layout, media, portal,
ID-selector, or cross-browser limitations recorded above.
