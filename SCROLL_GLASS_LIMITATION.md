# Scroll Glass State Limitation

## Status

The renderer is performant and correct during scrolling, but the transition between scrolling and idle glass is **not visually satisfactory**.

The active-scroll CSS treatment has been calibrated to resemble the idle WebGL material more closely. This reduced the difference in blur, tint, saturation, and text clarity, but it did not remove the underlying two-state behavior. When scrolling stops and the fresh backdrop capture finishes, the surface visibly snaps back into its full refractive WebGL glass state.

This snap is noticeable and should be treated as an unresolved product-quality issue.

## How the renderer currently works

### Idle state

When the page is idle and the backdrop texture is current:

- one shared WebGL2 renderer is visible
- every glass surface samples the same captured viewport texture
- the shader applies real texture-coordinate displacement, edge refraction, scattering, tint, chromatic separation, and rim lighting
- the CSS backdrop treatment on each surface is disabled
- ordinary text, controls, layout, accessibility, and interaction remain DOM/React

This is the full-quality glass state.

### Scroll start and active scrolling

As soon as the viewport moves:

1. The existing captured texture is marked stale by incrementing the viewport generation.
2. The stale WebGL canvas is hidden immediately.
3. The surface switches to a live CSS `backdrop-filter` treatment.
4. No DOM capture starts while scrolling is active.
5. Native browser scrolling remains responsive.

The temporary interaction treatment currently uses the configured tint, approximately `1.225px` blur for the default `blur: 3.5`, and `112%` saturation. These values approximate the calm center of the tuned shallow-surface shader. The permanent fallback used when WebGL is unavailable remains stronger and is a separate state.

The interaction presentation is live and tracks the moving DOM correctly, but it is blur/tint glass rather than refractive glass.

### After scrolling stops

After the last scroll input:

1. The renderer waits approximately 140 ms for the gesture to settle.
2. CSS glass remains visible.
3. Exactly one coalesced `html2canvas-pro` viewport capture begins.
4. The capture typically costs approximately 80–100 ms in the current demo and therefore remains strict idle-only work.
5. The result is accepted only if its generation still matches the current viewport.
6. The current texture is uploaded to the existing WebGL texture and drawn.
7. Once the scheduler is idle and the current generation has been uploaded and drawn, CSS glass is removed and WebGL fades back in.

The correctness contract prevents a previous scroll position from appearing as current glass. It does not make the CSS and WebGL optical models identical.

## Why the snap remains visible

The transition is between two fundamentally different rendering systems:

- CSS `backdrop-filter` samples the live browser backdrop and can blur, tint, and saturate it.
- The WebGL shader samples a discrete DOM snapshot and adds actual coordinate displacement and edge refraction.

CSS cannot reproduce the shader's curved displacement field in a reliable cross-browser way. When the fresh texture becomes available, typography, colored boundaries, and rings begin bending at the glass rim in one discrete state change. Matching the center blur and tint makes the two states closer, but it cannot interpolate the missing refraction.

The swap is especially visible when:

- large typography crosses the header edge
- concentric rings or sharp rules sit behind the glass
- a saturated color boundary crosses the footer
- the user stops repeatedly at arbitrary positions
- the settled DOM capture takes long enough for the CSS-only pause to be perceived

An opacity fade softens the replacement but does not interpolate between the two optical fields. The result still reads as a snap back into the "real" glass state.

## Current downsides

- The product has two visually distinct material states: live CSS glass while moving and refractive WebGL glass while idle.
- Real refraction disappears during active scrolling.
- The full glass state returns only after the settle debounce and expensive DOM capture complete.
- The return to WebGL can visibly shift or bend backdrop pixels, creating the post-scroll snap.
- DOM capture still causes an approximately 80–100 ms idle main-thread stall, even though it no longer blocks active scrolling.
- Improving the opacity transition alone cannot make the two rendering models identical.
- Showing the old WebGL texture during scrolling would remove the CSS switch but would display spatially stale content and violate the texture-freshness contract.
- Capturing repeatedly during scrolling could keep the texture closer to the DOM, but would regress the highest-priority performance invariant and produce serious main-thread jank.

## What has already been improved

- Active scrolling performs zero DOM captures.
- A full gesture is coalesced into exactly one settled refresh.
- Obsolete capture generations cannot become visible.
- Stale WebGL is hidden immediately instead of briefly compounding with CSS blur.
- The temporary CSS blur, saturation, and tint are calibrated much closer to the idle shader's center appearance.
- The stronger permanent fallback for unsupported browsers has not been weakened.

These changes make the two states more similar, but they do **not** solve the visible post-scroll snap.

## Constraints on a real fix

A satisfactory solution must preserve all of the following:

- zero DOM captures during active scrolling
- smooth native scrolling
- one shared WebGL2 renderer
- no stale texture displayed at a new viewport position
- exactly one coalesced refresh after settle
- real Chromium refraction when full glass is active
- ordinary DOM/React for content and controls

The existing arbitrary-DOM snapshot architecture cannot provide a continuously current refractive source during scrolling without either displaying stale pixels or rasterizing the DOM during interaction.

## Possible next directions

These require separate investigation and benchmarking; none is implemented yet.

1. **Use a continuously available source instead of arbitrary DOM capture.** Render the relevant background from application data into Canvas/WebGL, or let consumers provide a GPU-ready background texture. This can support true live refraction but is no longer transparent arbitrary-DOM sampling.
2. **Reproject a captured texture using scroll deltas and overscan.** This may keep fixed header/footer sampling aligned for limited scroll distances, but it needs extra captured area, strict bounds handling, and a revised freshness model. Newly exposed or mutated content would still be unavailable.
3. **Keep one presentation for the entire gesture plus an extended idle handoff.** A more deliberate transition could hide the snap perceptually, but it would not make the optical states equal and would delay real refraction further.
4. **Use CSS glass permanently.** This removes the state transition but abandons real refraction and therefore does not meet the core Chromium product requirement.
5. **Investigate compositor-native or browser-specific backdrop sources.** A platform API that exposes the live composed backdrop to WebGL would solve the source problem, but no reliable cross-browser arbitrary-DOM solution is currently used by this project.
6. **Benchmark constrained capture zones.** Capturing only header/footer regions or overscanned strips may shorten the settled pause, but cropping output alone may not reduce DOM clone/layout/paint cost. It also does not permit captures during active scrolling.

## Acceptance requirement for the eventual fix

The issue is resolved only when:

- scrolling and idle glass read as the same material
- stopping at text, rings, and sharp color boundaries produces no visible snap
- real refraction does not suddenly appear only after the capture completes
- active scrolling still records zero DOM captures
- each gesture still produces exactly one current-generation settled refresh
- no stale texture can flash or become visible
- scroll frame metrics remain within the existing performance guardrails

Until those conditions pass, the post-scroll glass-state transition should remain documented as an open and unsatisfactory limitation.
