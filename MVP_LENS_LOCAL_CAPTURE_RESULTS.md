# Lens-local capture MVP results

Date: 2026-09-07

## Implementation

The experiment leaves the shader, one-canvas renderer, generation checks, and React API unchanged. The branch adds:

- a lens-local crop enclosing every visible glass surface, maximum optical displacement/blur guard, and 0.35 viewport of vertical scroll overscan
- generalized source coordinates so the existing shader samples the cropped texture correctly
- separate timings for synchronous clone/traversal setup, asynchronous rasterization, `createImageBitmap()`, and WebGL upload
- texture byte reporting and a `?capture=viewport` A/B baseline (lens-local is the branch default)

This is deliberately still an `html2canvas-pro` experiment. It reduces requested raster bounds, but does not replace the library's document-root cloning and style collection.

## Chromium measurements

Environment: Chrome 152, WebGL2, 1200×909 viewport, DPR 2, high quality, capture scale 0.75. Values are the settled sample after each required fixture state. Frame figures retain capture stalls, as required.

| Capture / fixture state | Total capture | Traversal | Raster | Bitmap prep | Upload | Texture | Bytes | Frame p95 / worst |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| viewport / synthetic baseline | 115.5 ms | 9.4 ms | 88.4 ms | 17.5 ms | 0.8 ms | 900×4772 | 17.18 MB | 33.7 / 49.9 ms |
| lens-local / synthetic | 111.1 ms | 11.8 ms | 89.6 ms | 9.5 ms | 0.4 ms | 733×1158 | 3.40 MB | 34.2 / 341.7 ms |
| lens-local / FAQ collapsed under header | 102.3 ms | 16.0 ms | 85.9 ms | 0.3 ms | 0.9 ms | 733×1127 | 3.30 MB | 34.3 / 341.7 ms |
| lens-local / FAQ expanded | 107.1 ms | 12.3 ms | 94.6 ms | 0.2 ms | 0.5 ms | 733×582 | 1.71 MB | 34.3 / 341.7 ms |
| lens-local / timed FAQ question under header | 107.4 ms | 17.7 ms | 88.4 ms | 0.9 ms | 0.6 ms | 733×1158 | 3.40 MB | 34.2 / 341.7 ms |

The viewport baseline uses the existing three-viewport overscan, while the local prototype uses the deliberately smaller local overscan described above. Capture count/backlog remained coalesced: one in flight at most and no accumulating queue. The four-state local sequence reached 13 total captures due to reload/scroll/mutation invalidations; no overlapping capture was observed. Exact or valid scroll-compensated sources were produced after settle. The transient `invalid` reading in the synthetic checkpoint was caused by a later fixture timer mutation, and correctly hid rather than presenting an obsolete source.

These figures are directional rather than a lab-grade median/p95 run: the available automation surface could reliably retain Chromium samples but not generate a stable repeated percentile suite, and Safari/Firefox were not available for this pass.

## MVP conclusion

Lens-local output materially reduces texture area and GPU storage (about 80–90% here), and upload falls below 1 ms. It does **not** materially reduce acquisition wall time: rasterization remains roughly 86–95 ms and total capture remains roughly 102–111 ms. The dominant work therefore does not scale with output pixels in this `html2canvas-pro` document-root path.

The mobile header + footer also span almost the full viewport when represented as one contiguous crop, so this approach has an architectural floor even before traversal cost is addressed.

Per the stop rule, do not polish this crop into the production architecture. The next experiment should avoid full document cloning/style traversal—most plausibly a retained/source-aware display list or independently captured/packed bands with cached nodes and dirty-region updates. The reduced texture/upload measurements remain useful for that design.
