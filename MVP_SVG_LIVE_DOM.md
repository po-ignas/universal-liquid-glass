# MVP — SVG Live-DOM Displacement

## Question
Can ordinary SVG filter/displacement applied to a deliberately controlled live DOM subtree provide convincing liquid-glass refraction without screenshot -> texture acquisition?

## MVP only
This branch tests the architectural shortcut, not universal production compatibility. Keep it tiny. No expensive regression suite.

## Must implement
- Wire `examples/DeliveryMarketFaqFixture.tsx` into the demo and scroll it beneath a fixed glass test area.
- Build the minimum explicit DOM arrangement/wrapper/duplication needed to test SVG `filter: url(...)` / `feDisplacementMap` against live content.
- Use obvious nonlinear displacement so we can distinguish true warping from blur.
- FAQ timer and expand/collapse must continue to update so we can see whether the filtered representation stays live.
- Avoid html2canvas/WebGL capture for the experimental path.
- Test only the browsers immediately available/cheap to test; Chromium is sufficient for MVP. Record exactly what worked.
- Report layout/duplication constraints: whether arbitrary backdrop is possible or whether content must be explicitly wrapped/cloned/rearranged.

## Acceptance
Demo builds/opens; FAQ fixture is visible in the experiment; genuine displacement is visible; dynamic FAQ update is represented; no screenshot acquisition is used for this path; limitations are clearly documented.

## Non-goals
Universal arbitrary-backdrop support, production fallback matrix, exact Apple optics, broad browser testing, accessibility duplication solution, API polish.

## Stop rule
Once feasibility and the structural limitation are clear, stop. Do not spend time forcing this technique to behave like a universal backdrop primitive if the browser model prevents it.

## Implementation result

The MVP renders the same controlled React subtree twice: once as the ordinary scrolling document and once inside a fixed, clipped lens. The lens copy is translated by the document scroll offset and filtered with SVG `feTurbulence` plus a 58px `feDisplacementMap`. Both copies receive the same lifted FAQ timer and expand/collapse state, so changes remain live without rasterization, texture upload, or WebGL.

This proves genuine, continuously updated displacement for an explicitly duplicated DOM subtree. It does **not** provide an arbitrary-backdrop primitive: SVG `filter` only filters the element's own rendered subtree, not unrelated content visually behind the lens. A consumer would have to wrap the desired content inside the filtered element or render a synchronized duplicate/rearrangement as this MVP does. Duplication introduces layout synchronization, accessibility, identity/state, width, font, and scroll-coordinate constraints; the mirrored copy is therefore marked `aria-hidden` and non-interactive for this experiment.

Chromium MVP check (2026-09-07): Vite production build succeeds. In Chromium, the fixed lens remained aligned during scroll and showed obvious nonlinear warping along stripe and text edges. The FAQ timer advanced in both copies, expanding the source created the expanded panel in both the source and filtered mirror, and the browser console reported no errors.

## Hardened provider and Delivery Market check

The follow-up implementation replaces the second React render with one
imperative DOM mirror managed by `SvgLiveDomProvider`. React components,
effects, event handlers, network activity, and local state mount only once.
The mirror is `inert`, `aria-hidden`, non-interactive, stripped of IDs and
accessibility references, and updated incrementally from source mutations.
Input/select/textarea runtime state is synchronized separately. Elements
marked `data-svg-live-ignore`, `data-html2canvas-ignore`, or
`data-liquid-glass-surface` preserve layout but are hidden in the mirror.

One viewport-sized filtered layer is clipped to the union of every visible
registered glass surface. This keeps a single mirror/filter for a desktop
header or mobile header plus footer; it does not create one duplicate per
surface or a document-height SVG filter allocation. Window and visual viewport
scroll/resize updates are coalesced through one animation frame.
Nested element scroll offsets are mirrored directly, so touch/trackpad-driven
carousels and card rails remain at the same live position beneath the glass;
those visual changes are otherwise invisible to `MutationObserver`.
While a rail remains in momentum/snap motion, its source offset is sampled on
every animation frame and the mirror's own smoothing/snapping is disabled.
CSS transitions, CSS animations, and recreatable Web Animations are paired to
the source timeline and likewise synchronized only while active.

Delivery Market was exercised locally in Chromium with its real page tree:

- 2,319 mirrored nodes;
- 41.7–63.9 ms initial clone across observed reloads;
- 0.45 ms average mirror alignment/visible-surface measurement during the
  sampled mobile scroll sequence;
- one visible desktop header surface and two visible mobile header/footer
  surfaces;
- no mirror rebuilds during repeated fast scrolling;
- the mobile FAQ sheet opened and closed without a console error or recursive
  mirror invalidation;
- no application screenshot, bitmap preparation, texture upload, or WebGL
  context was created by this provider.

This is now suitable for an opt-in Delivery Market test, not a universal final
renderer. The mirror approximately doubles DOM/layout ownership, removes IDs
so ID-based CSS inside the mirror is unsupported, and cannot perfectly mirror
video, WebGL canvas, cross-document portals, component-local animation phase,
or arbitrary fixed/sticky descendants. Safari/Firefox and real-device memory
remain unverified.
