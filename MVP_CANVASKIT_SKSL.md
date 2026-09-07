# MVP — CanvasKit + SkSL

## Question
Can we avoid repeated DOM screenshot/upload cost by rendering the relevant scene into one retained GPU-backed CanvasKit surface and applying liquid-glass refraction in SkSL?

## MVP only
Do not productionize. Do not broaden browser support. Do not port every CSS feature. Do not run expensive regression suites. Stop when the architecture is visibly proven or clearly blocked.

## Must implement
- Keep the existing project/demo as the comparison baseline.
- Wire `examples/DeliveryMarketFaqFixture.tsx` into the demo and make it scroll beneath a fixed glass surface.
- Add the minimum CanvasKit integration needed to reproduce a constrained scene containing text, rounded cards/backgrounds, gradients, and the FAQ fixture representation.
- Keep the scene retained; do not rebuild/rasterize the whole DOM every frame.
- Apply an obvious liquid-glass/refraction effect through SkSL or the closest CanvasKit runtime-effect path. Optical parity with the current shader is not required for this spike.
- Demonstrate scroll and one dynamic FAQ/timer/update without a full-page recapture.
- Add a tiny debug readout with initialization time, update time/frame timing, and whether any DOM screenshot path is used.

## Do not implement
- full CSS fidelity
- full accessibility mirror work
- Safari/Firefox support
- production API redesign
- exhaustive tests
- shader calibration
- large refactors unrelated to the experiment

## Acceptance
- demo builds and opens
- FAQ stress fixture is present
- fixed glass visibly refracts moving content
- scrolling works
- dynamic FAQ/state update works
- no fatal console errors
- report whether DOM capture is eliminated from the steady-state path and record rough timings

## Stop rule
Once the above works, stop. Do not autonomously optimize or harden further.

## Final report
State: files changed, architecture used, whether pixels remain GPU-resident, any DOM capture/upload still required, startup/update/frame timings, biggest blocker, and whether this path deserves a second iteration.
