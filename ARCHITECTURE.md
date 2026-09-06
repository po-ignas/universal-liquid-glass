# Architecture

## Runtime ownership

`GlassProvider` creates exactly one `GlassRenderer` after client mount. The renderer prepends one fixed, pointer-transparent canvas to the provider root and owns one WebGL2 context, program, VAO/VBO, and background texture. `GlassSurface` registers an ordinary `div`; it never owns a canvas or render loop.

The provider root establishes an isolated stacking context. The shared canvas paints at z-index 1000, registered surfaces at 1001, and each surface's normal DOM children therefore remain interactive and accessible above its WebGL pixels.

## Capture and coordinates

`captureViewport` rasterizes the provider DOM with `html2canvas-pro` using the live viewport and scroll coordinates. Renderer, surface, and debug subtrees are ignored in the clone, avoiding recursive glass and live-DOM visibility mutations. All surfaces sample the same normalized viewport texture. Refraction overscan comes naturally from neighboring pixels in that shared texture.

Only the visible viewport is allocated. Same-sized captures update existing texture storage with `texSubImage2D`; a viewport/quality dimension change uses `texImage2D`. The capture canvas becomes collectible after upload and is never retained.

## Optical model

The vertex stage positions a unit quad over each live surface rect. The fragment stage uses a rounded-box signed-distance field for shape masking, edge depth, and outward normals. Surface thickness and aspect ratio produce an internal optical profile: shallow, wide navigation pills reduce total lens depth while a squared edge falloff and narrow exponential lip concentrate displacement at the boundary. The center retains only a very small displacement floor. Scattering and chromatic separation follow the same size-aware edge profile, so they do not smear the calm center uniformly. The displaced backdrop is sampled with a tier-dependent 5/9/13-tap scattering kernel. HIGH/MEDIUM add two low-cost channel-offset samples. Tint, an edge/Fresnel approximation, directional rim specular, and opposing inner shading finish the material.

This is real texture-coordinate displacement. CSS `backdrop-filter` is used while the captured texture is stale or being refreshed, and as the permanent fallback when WebGL2 is unavailable.

## Invalidations and idle behavior

The renderer is dirty-driven. ResizeObserver updates geometry; passive capture-phase scroll events mark the backdrop stale; MutationObserver excludes changes inside glass/debug/renderer nodes and debounces other content changes; `popstate` invalidates after route history navigation. Repeated requests are coalesced, a capture is never run concurrently, and the requestAnimationFrame loop stops once capture and drawing settle.

Every relevant viewport/content change increments a viewport generation. A capture records that generation, and its output is discarded if the viewport generation changes before completion. The WebGL layer can become visible only after a current-generation texture upload and draw, while the scheduler is idle with no pending work and current surface geometry. Scrolling starts zero captures; the stale canvas is hidden without a fade that could compound both backdrop treatments, and an interaction-safe CSS treatment matches the shader's low-blur center and tint. A 140 ms settle timer requests one coalesced refresh behind that CSS glass, then current WebGL fades back in. Resize uses the same mechanism with a 160 ms settle timer. Capture failure leaves CSS active and permits at most one conservative idle retry for that generation. Permanent WebGL-unavailable fallback retains its stronger blur/tint treatment.

## Quality controller

Hardware concurrency, optional device memory, DPR, reduced motion, and WebGL2 availability seed the initial tier. Actual recent requestAnimationFrame intervals and capture duration then override that guess. Downgrades require repeated stress and occur faster than upgrades. LOW can fall through to CSS after sustained failure or expensive work; fallback also activates on WebGL context loss.

## Scope choices

- Viewport capture was chosen over Hla-aung's full-document texture because long pages can exceed GPU texture limits and memory budgets.
- Raw WebGL2 was chosen over Three.js to minimize dependency and resource overhead.
- SVG displacement in `backdrop-filter` was rejected as the universal path because Safari and Firefox do not provide the required behavior.
- Continuous animation, spring physics, arbitrary lens presets, and dynamic scene support were omitted because navigation glass should be still when the page is idle.
