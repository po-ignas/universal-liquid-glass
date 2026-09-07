# Liquid Glass Architecture — Shared Experiment Evaluation

## Purpose
Evaluate all architecture branches against the same workload. This phase is measurement/research, not implementation. Do not improve an experiment while evaluating it except for minimal instrumentation required to obtain comparable measurements.

## Branches
- `mvp/lens-local-capture`
- `poc/canvaskit-sksl`
- `poc/retained-scene`
- `poc/pixi-html-source`
- `poc/svg-live-dom`

## Two-stage evaluation

### Stage A — standardized fixture
Every branch must first be tested with the same functional workload. Existing demo-page decoration/layout is irrelevant; compare the same underlying stress behavior:

1. fixed glass surface with content moving beneath it
2. text, rounded backgrounds/cards, gradient/color, and ordinary page content
3. Delivery Market FAQ behavior:
   - active question changes every 4 seconds
   - visible progress bar animates continuously from 0→100% during those 4 seconds
   - progress resets when the question advances
   - expand/collapse changes DOM/state
4. continuous scrolling while the progress animation is running
5. dynamic question transition while content is beneath/near glass

If a branch lacks the continuously animated progress bar, add only the minimum fixture/instrumentation needed to make this workload equivalent. Do not redesign the architecture while doing so.

### Stage B — real Delivery Market integration
The standardized fixture is for controlled comparison; the real project is the decisive validation for promising branches.

Do **not** integrate all five into Delivery Market immediately. After Stage A, take the best 2 (maximum 3 if results are genuinely close) and test them against the actual Delivery Market page/component where the glass/footer/header problem occurs.

For the real-project test, preserve the actual DOM complexity, responsive desktop/mobile variants, FAQ timer/progress animation, scrolling, images/icons/text, and real fixed header/footer arrangement. Avoid simplifying the page merely to make an architecture pass.

## Fixed test conditions
For comparisons use the same machine, Chromium version, viewport/DPR, approximate scroll sequence, and duration. Run branches individually rather than benchmarking several dev servers under heavy concurrent load. Record the exact URL/port and branch tested.

## Correctness gate — must pass before performance can win
Record PASS/FAIL for:
- genuine nonlinear refraction/warping is visible (not merely blur/transparency)
- correct underlying content is sampled/rendered
- no obvious stale/frozen backdrop during normal interaction
- scrolling remains visually correct
- FAQ question changes every 4 seconds
- progress bar visibly animates continuously and resets correctly
- expand/collapse is represented correctly
- no major clipping/layout duplication/flicker
- no fatal console errors

A fast implementation that fails equivalent rendering/correctness cannot beat a slower correct implementation.

## Measurements
Use browser performance APIs/devtools or lightweight instrumentation. Avoid building a large benchmark framework.

Record where applicable:
- initialization/startup cost
- average frame time during continuous scroll
- frame p95 and worst frame during continuous scroll
- visible dropped/janky frames
- latency from FAQ/state change to correct rendered result
- behavior while the progress bar is continuously animating
- DOM capture/rasterization median/p95
- GPU upload median/p95
- capture/upload count during active scrolling
- capture/upload count during one 4-second progress cycle
- texture/canvas dimensions and approximate bytes where meaningful
- CPU usage observations if easily obtainable
- bundle/runtime overhead if architecture introduces a substantial dependency

If a metric does not apply to an architecture, write `N/A` and explain why rather than inventing an equivalent number.

## Architecture facts to record
- Is DOM screenshot/rasterization used? When?
- Are pixels repeatedly transferred CPU→GPU?
- Does scrolling trigger reconstruction/capture or primarily move retained/camera state?
- Does the continuously animated progress bar trigger expensive work every frame?
- Are pixels/scene retained GPU-side?
- What content/CSS cannot be represented?
- Does it require DOM duplication/wrapping/rearrangement?
- Browser/API/flag restrictions?
- Cross-origin/security constraints encountered?
- Approximate implementation/runtime complexity.

## Visual assessment
Compare against the current known-good liquid-glass MVP visually. Record:
- refraction strength/shape
- edge/specular quality
- blur/scattering/chromatic behavior where implemented
- temporal stability during scroll
- temporal stability during progress animation/state change

Do not penalize an architecture spike for missing final optical calibration if it proves the source/rendering architecture. Do penalize it if the technique fundamentally cannot produce the required effect or correct content.

## Result classification
Choose one:
- **PASS / LEADING** — correct enough, architecturally viable, and performance justifies real-project validation
- **PROMISING / BLOCKED** — strong architecture but a concrete browser/API/fidelity blocker exists
- **FAIL** — architecture does not solve the problem or requires unacceptable compromises

State the single biggest advantage and single biggest blocker.

## Output per branch
Create/update `EXPERIMENT_RESULTS.md` on that experiment branch containing:
1. branch + commit tested
2. environment/URL/port
3. correctness table
4. measurements
5. architecture facts
6. visual assessment
7. result classification
8. biggest advantage/blocker
9. recommendation: advance to real Delivery Market test — YES/NO

## Evaluator guardrails
- Evaluate; do not redesign.
- Minimal fixture/instrumentation fixes are allowed only to make tests equivalent.
- Do not run expensive broad regression/e2e suites.
- Do not fix unrelated failures.
- Do not optimize after seeing measurements.
- Clearly distinguish measured values from observations/estimates.
- Stop when this document's evidence is collected.

## Final comparison
After all Stage A reports exist, a separate evaluator should compare all `EXPERIMENT_RESULTS.md` files, reject non-equivalent/invalid comparisons, rank the approaches, and select the best 2 (up to 3 only if close) for Stage B real-project testing.
