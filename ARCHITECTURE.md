# Architecture

## Runtime ownership

`GlassProvider` creates exactly one `GlassRenderer` after client mount. The renderer prepends one fixed, pointer-transparent canvas to the provider root and owns one WebGL2 context, program, VAO/VBO, and background texture. `GlassSurface` registers an ordinary `div`; it never owns a canvas or render loop.

The provider root establishes an isolated stacking context. The shared canvas paints at z-index 1000, registered surfaces at 1001, and each surface's normal DOM children therefore remain interactive and accessible above its WebGL pixels.

## Capture and coordinates

`captureViewport` rasterizes the provider DOM with `html2canvas-pro` using the live viewport and scroll coordinates. Renderer, surface, and debug subtrees are ignored in the clone, avoiding recursive glass and live-DOM visibility mutations. All surfaces sample the same normalized viewport texture. Refraction overscan comes naturally from neighboring pixels in that shared texture.

Only the visible viewport is allocated. Same-sized captures update existing texture storage with `texSubImage2D`; a viewport/quality dimension change uses `texImage2D`. The capture canvas becomes collectible after upload and is never retained.

## Optical model

The vertex stage positions a unit quad over each live surface rect. The fragment stage uses a rounded-box signed-distance field for shape masking, edge depth, and outward normals. A broad curved-lens term blends radial and SDF normals; a tighter exponential lip increases edge displacement. The displaced backdrop is sampled with a tier-dependent 5/9/13-tap scattering kernel. HIGH/MEDIUM add two low-cost channel-offset samples. Tint, a cubic edge/Fresnel approximation, directional rim specular, and opposing inner shading finish the material.

This is real texture-coordinate displacement. CSS `backdrop-filter` is used only in FALLBACK.

## Invalidations and idle behavior

The renderer is dirty-driven. ResizeObserver updates geometry; passive capture-phase scroll events invalidate position/backdrop; MutationObserver excludes changes inside glass/debug/renderer nodes and debounces other content changes; `popstate` invalidates after route history navigation. Repeated requests are coalesced, a capture is never run concurrently, and the requestAnimationFrame loop stops once capture and drawing settle.

During scrolling the capture cadence is relaxed and scale reduced. A 150 ms scroll-settle timer requests the final clean capture. Resize captures wait 180 ms after the last event.

## Quality controller

Hardware concurrency, optional device memory, DPR, reduced motion, and WebGL2 availability seed the initial tier. Actual recent requestAnimationFrame intervals and capture duration then override that guess. Downgrades require repeated stress and occur faster than upgrades. LOW can fall through to CSS after sustained failure or expensive work; fallback also activates on WebGL context loss.

## Scope choices

- Viewport capture was chosen over Hla-aung's full-document texture because long pages can exceed GPU texture limits and memory budgets.
- Raw WebGL2 was chosen over Three.js to minimize dependency and resource overhead.
- SVG displacement in `backdrop-filter` was rejected as the universal path because Safari and Firefox do not provide the required behavior.
- Continuous animation, spring physics, arbitrary lens presets, and dynamic scene support were omitted because navigation glass should be still when the page is idle.
