# MVP — PixiJS HTMLSource

## Question
If the browser/Pixi experimental HTMLSource path can expose live DOM as a GPU texture, does it remove the expensive screenshot/upload bottleneck enough to be the ideal future fast path?

## MVP only
Experimental Chrome-only behavior and required browser flags are acceptable. Do not turn this into a cross-browser implementation. Do not run expensive regression tests.

## Must implement
- Wire `examples/DeliveryMarketFaqFixture.tsx` into the existing demo and place it beneath fixed glass.
- Integrate the minimum current Pixi HTMLSource/HTML-in-canvas mechanism needed to source the live FAQ/demo DOM as a GPU texture.
- Feed that source into an obvious refraction/displacement shader. Exact current optics are not required.
- Keep the actual DOM interactive where the API permits it.
- Demonstrate scroll plus FAQ timer/expand update.
- Measure rough setup/update/frame behavior and explicitly report whether screenshot/raster-to-canvas work remains.
- If the required browser capability/flag blocks execution, prove the blocker quickly and stop rather than building a substitute architecture.

## Acceptance
Either (A) working live DOM -> GPU -> refractive glass with FAQ interaction, or (B) a concrete reproduced platform/API blocker. In case A: demo builds, scroll/update work, no fatal errors, rough timings recorded.

## Non-goals
Safari/Firefox, production fallback system, full shader parity, broad test suite, package cleanup, API redesign.

## Stop rule
Once A or B is established, stop and report. Do not replace HTMLSource with html2canvas just to make the branch pass.
