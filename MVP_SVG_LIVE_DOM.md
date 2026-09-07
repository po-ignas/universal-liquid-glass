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
