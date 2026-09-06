# Apple-like Thick Glass Warp Profile

## Status

Active visual experiment: **restore convincing geometric backdrop warping without returning to broad blur/smear**.

This task is based on manual comparison with the interactive liquid-glass reference demo. The important reference behavior is not just blur or tint: the backdrop geometry is visibly bent through the entire glass body, with stronger optical compression/expansion near the top/bottom/side curvature and a thinner bright rim.

The current renderer already has the correct capture, overscan, scroll-compensation, generation, and continuous-WebGL architecture. Preserve all of it.

Do not touch source acquisition or scroll behavior in this task.

---

# 1. Current problem

The latest calibration over-corrected toward a nearly clear lens:

- edge/lip behavior improved
- broad smear was reduced
- but the glass body lost too much geometric warping and material presence
- the center now reads almost like transparent acrylic rather than a shaped volume of glass

The target reference shows a much stronger **shape-preserving lens warp**:

- horizontal lines behind the glass visibly bow/compress through it
- the backdrop appears optically displaced across much of the surface, not only within a tiny edge strip
- distortion remains coherent and smooth rather than blurry or duplicated
- top/bottom curvature is especially visible
- the effect looks like a thick rounded glass volume

We need to restore that behavior while keeping the newer improvements to clarity and edge control.

---

# 2. Important distinction

Do NOT solve this by simply increasing blur.

We need two independent optical components:

```text
A. BODY WARP
smooth geometric remapping across much of the interior
moderate strength
coherent, low-frequency, shape-preserving

B. EDGE/LIP WARP
stronger local refraction near curved perimeter
thin/high-frequency
plus subtle Fresnel/specular/chromatic response
```

The current shader mostly emphasizes B after the previous calibration. This experiment must reintroduce A as geometric UV displacement, not as scattering.

---

# 3. Desired geometric behavior

For a rounded rectangle, the backdrop should behave approximately like a thick convex lens:

```text
outside backdrop line:
------------------------------

inside glass:
      ______________
_____/              \_____

```

or for horizontal bands:

```text
outside:  =====================
inside:   ===---________---=====
```

Exact direction depends on the local surface normal and chosen IOR-like behavior, but visually:

- content should bend smoothly entering the glass
- center should remain coherent, not multiply sampled or smeared
- top and bottom regions should show clear optical compression/expansion
- left/right curved ends should bend content laterally
- the warp must be continuous, without visible seams between center and edge

---

# 4. Recommended shader structure

Keep the existing rounded-box SDF and local surface coordinates.

Add a **broad body lens term** before the existing narrow edge/lip term.

Conceptually:

```glsl
vec2 p = v_local / halfSize;         // normalized local shape coordinates
float r2 = dot(p, p);

// broad, low-frequency body curvature
float bodyCurve = f(p, signedDistance, aspectRatio, thickness);
vec2 bodyOffset = direction * bodyCurve * bodyStrength;

// existing narrow perimeter refraction
vec2 edgeOffset = -lensDirection * edgeLensPixels;

vec2 totalOffset = bodyOffset + edgeOffset;
```

Do not copy this literally if a better formulation fits the existing shader. The requirement is the two-scale optical model.

### Candidate body-warp profiles

Benchmark visually one or two simple formulations only; do not over-engineer.

Possible approach A — radial/barrel-like lens:

```text
bodyWarp ∝ p * (1 - normalizedDistanceToCenter²)
```

Possible approach B — rounded-rectangle depth profile:

```text
bodyWarp ∝ local surface normal × smooth interior depth curve
```

Possible approach C — separable x/y convex profile for shallow bars:

```text
vertical body warp stronger than horizontal for very wide shallow headers
horizontal warp stronger near rounded endcaps
```

For navigation bars, C may visually match the reference best because the top/bottom bend is dominant while the long center span should stay coherent.

---

# 5. Shallow-header adaptation

For a wide 56–70 px navigation pill, do not use isotropic magnification across the whole width.

Desired behavior:

- strong vertical optical curvature across the glass height
- restrained horizontal body warp through the long middle section
- stronger horizontal warp near rounded endcaps
- center of long horizontal text should remain readable/coherent

The current aspect-ratio/thickness logic should be reused, not removed.

Think of the header as a **thick horizontal glass bar**, not as a circular magnifying lens.

---

# 6. Material body

Once geometric body warp is visible, add only enough scattering/tint to make it read as material.

Target:

- mild interior diffusion
- visible backdrop color transmission
- subtle white/neutral lift
- mild contrast softening
- no foggy/milky center

Do not use blur to create the warp illusion.

The backdrop should still be geometrically recognizable.

---

# 7. Chromatic and rim behavior

Keep chromatic aberration subtle and perimeter-weighted.

Keep the thin bright rim from the previous calibration.

Reference-like priority:

```text
geometric warp > material transmission > thin Fresnel rim > chromatic accent
```

Chromatic separation must not become the dominant signal.

---

# 8. Demo requirement

Use the existing difficult typography/rings demo and add or preserve a test with straight horizontal/vertical lines or bands behind the glass.

The line/band test is critical because it makes geometric warping unambiguous.

A successful test should visibly show:

- horizontal bands bend vertically through the glass body
- vertical edges/lines bend around rounded endcaps
- body warp remains coherent while scrolling
- no duplicate/ghost copies of text
- no huge blurry smear

Do not simplify the demo background.

---

# 9. Acceptance target

Manual review should immediately answer “yes” to these:

1. Does the glass visibly warp geometry behind it even away from the outermost 3–5 px rim?
2. Is the warp smooth and lens-like rather than blurry/smeared?
3. Do straight lines visibly bow/compress through the glass?
4. Does the long center of a navigation bar remain readable?
5. Are endcaps optically stronger than the long center span?
6. Is the glass still clearly visible over simple backgrounds?
7. Does the same warp remain during continuous WebGL scrolling?

If the answer to #1 is no, the body warp is too weak.
If #2 is no, reduce scattering and improve coordinate remapping rather than adding blur.
If #4 is no, reduce horizontal body warp for shallow/high-aspect surfaces.

---

# 10. Performance guardrail

Prefer mathematical coordinate remapping over extra texture taps.

Do not materially increase sample count unless necessary.

The existing renderer already runs comfortably during scroll; preserve that performance.

After material changes, verify:

- WebGL remains visible during scroll
- captures this scroll gesture = 0
- source state can remain scroll-compensated
- no regression in frame average/p95/worst beyond a small margin

---

# 11. Scope restrictions

Do NOT modify:

- capture manager
- overscan size/strategy
- scroll-delta compensation
- capture scheduler
- generation/freshness tracking
- React public API
- browser fallback logic
- source replenishment

Do not restart Milestone 4 work in this run.

Change only shader/material defaults/debug demo support required to tune this warp.

---

# 12. Implementation order

1. Read current `shaders.ts`, `surfaceOptions.ts`, and the prior visual-calibration notes.
2. Preserve the current narrow edge/lip profile.
3. Add one broad low-frequency body-warp term as UV geometry displacement.
4. Adapt body warp for shallow wide navigation bars: stronger vertical body curvature, restrained horizontal middle-span distortion, stronger endcaps.
5. Add/verify straight line/band visual test in demo.
6. Tune body strength until the reference-like geometric bending is obvious.
7. Add modest interior scattering/tint only after geometric warp looks correct.
8. Verify large typography remains coherent.
9. Verify continuous scrolling still shows the same warp and zero active captures.
10. Run focused build/tests only.
11. STOP for manual visual review.

Do not spend time on Safari/Firefox/mobile validation in this visual pass.

---

# 13. Completion report

Report only:

- shader/default files changed
- body-warp formula used
- how shallow wide surfaces are anisotropically adapted
- whether any extra texture samples were added
- before/after visual behavior for straight bands and large text
- frame avg/p95/worst after change
- confirmation of continuous WebGL + zero captures during scroll

Then stop for manual review.
