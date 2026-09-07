# Lens-local demo stabilization

Date: 2026-09-07

## Outcome

The demo's ordinary scrolling path is now materially more stable in Chromium:

- post-scroll captures use one absolute document-coordinate system, fixing the case where a capture was marked `exact` but sampled an old page location;
- lens-local overscan grows from 0.35 viewport to a bounded target of 8 viewports, using the actual surface-union dimensions while retaining the existing texture-size and approximately 24 MiB source limits;
- unusually long gestures may perform multiple velocity-led replenishments while keeping the existing WebGL source visible: four below 120 ms, two through 180 ms, and none above 180 ms;
- at most one capture is in flight;
- source exhaustion is recoverable: an invalid texture is hidden, an exact settled capture is queued, and WebGL is restored automatically instead of permanently disabling the renderer.

The shader, optical settings, shared-canvas architecture, React API, and exact/compensated/invalid mapping contract remain unchanged.

## Correctness fix

`html2canvas-pro` was previously given both an absolute document crop and the live page scroll for a document-root capture. Initial captures at `scrollY=0` compensated correctly, but settled captures at a nonzero scroll could contain pixels from the wrong document position while the renderer labeled the source `exact`.

The capture clone now remains at document origin while `x`/`y` alone identify the absolute crop. Source metadata continues recording the real capture scroll origin for WebGL compensation. Visual verification at `scrollY=1260` changed the center lens from incorrectly showing the old hero heading to correctly showing the underlying `THICK GLASS` field before and after the settled texture rebase.

## Chromium measurements

The original stabilization baseline below used the earlier 3.25-viewport
window. The recovery revision was then checked in a 444×1044, DPR 2 viewport:

- 8,352 CSS px overscan per side, enough to cover the demo's complete 6,399 px scroll range;
- 333×13,311 source / 17,730,252 bytes;
- 91.1–113.7 ms captures and approximately 8.3 ms average render frames;
- an instant top-to-bottom jump remained `scroll-compensated` and WebGL-visible;
- a forced small-window exhaustion hid the invalid source, then returned to exact WebGL after the settled 94.3 ms recapture.

Environment: Codex in-app Chromium, 1280×720 desktop viewport, DPR 2, HIGH quality, capture scale 0.75 unless stated otherwise.

| Check | Result |
| --- | --- |
| Initial bounded lens source | 733×3615, 10,599,180 bytes, 2340 CSS px overscan per side |
| Initial capture | 105.4 ms total: 10.0 traversal, 84.2 raster, 11.0 bitmap preparation, 0.8 upload |
| 1,184 px active scroll | WebGL visible, `scroll-compensated`, 0 captures, 8.3 ms average / 8.9 p95 / 9.3 worst |
| 2,139 px uninterrupted scroll | WebGL visible, `scroll-compensated`, 201 px remaining, 0 captures during the sampled gesture |
| Settled rebase at 1,260 px | Correct underlying pixels, `exact`, WebGL remained visible; 94.3 ms capture and 0.6 ms upload |
| Sustained wheel-style sequence | One active replenishment; source rebased to 1,804 px and remained visible at another 325 px delta; 8.7 ms average / 9.3 p95 / 42.1 worst; 97.1 ms capture |
| Capture backlog | None observed; maximum one in flight |

Responsive check at 390×844, DPR 1:

- source texture: 292×4747 / 5,544,496 bytes;
- vertical overscan: 2743 CSS px per side;
- observed capture: 111.4 ms total, including 90.9 ms raster and 0.7 ms upload;
- header/footer and post-resize settled captures were aligned and returned to `exact` WebGL presentation.

These are directional local-demo observations, not a new cross-browser benchmark suite.

## Why this demo is near 100 ms while Delivery Market can approach one second

The larger source band did not materially increase this demo's capture time because output pixels and upload are not the dominant cost here. `html2canvas-pro` still clones and parses `document.documentElement`; this demo has a relatively small tree, local assets, and constrained CSS. A real Next.js page can add far more nodes, computed styles, fonts, images, pseudo-elements, responsive branches, and mutation activity. Those costs can make end-to-end invalidation → clone → raster → bitmap → upload → accepted draw much longer than the raster sample in this fixture.

Lens-local capture is therefore genuinely faster in texture storage/upload, but it has not proven that a complex real page's DOM acquisition becomes proportionally faster. Delivery Market must be measured directly from the pinned candidate implementation.

## Remaining limitations

- A CSS-only animation such as the FAQ progress transform does not update pixels already stored in the WebGL texture. The live DOM animates, but the refracted captured copy remains frozen until another source capture.
- A relevant DOM change while beneath glass invalidates scroll compensation. With the current approximately 100 ms backend, the safe behavior is stable whole-session CSS fallback; presenting the old texture would violate the correctness contract.
- Rolling replenishment is deliberately bounded by measured capture cost. If a gesture still outruns the source, CSS may appear briefly while the exact settled capture completes; WebGL then restores automatically.
- Fixed/sticky/video/canvas content behind glass is not established by the document-origin capture fix.
- Only Chromium was exercised. Safari, Firefox, real mobile hardware, memory growth, and context-loss behavior remain unverified.

## Assessment

This branch is now a useful and visually correct demo for ordinary document-flow scrolling across the intended fixed navigation surfaces, including long scroll distances that previously exhausted 0.35-viewport overscan immediately. It is more promising than the evaluated version, but it is not yet a complete continuous-live-DOM solution. The decisive next step is a frozen-commit Delivery Market measurement focused on its real capture time and relevant dynamic content beneath the actual header/footer.
