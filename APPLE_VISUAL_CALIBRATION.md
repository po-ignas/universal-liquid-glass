# Apple-Like Liquid Glass Visual Calibration

## Purpose

This is a narrow visual-calibration task for the existing renderer.

Do **not** redesign capture, overscan, scroll compensation, texture generation, React API, or performance architecture while executing this task.

The goal is to make the default material visually much closer to Apple's current Liquid Glass navigation/control material while preserving the already-working continuous WebGL POC.

Exact reproduction of Apple's private material implementation is not possible from public APIs, so the acceptance target is **perceptual similarity**, not claiming byte-for-byte or physically identical rendering.

Apple's own guidance describes Liquid Glass as a dynamic material for controls/navigation that lets background content and color pass through, preserves legibility, and creates optical bending particularly at material boundaries. Apple's default Liquid Glass has no inherent color; it primarily takes color from content behind it. Apple also distinguishes `regular` and `clear` variants.

## Current problem observed in our screenshots

The renderer is clearly producing real refraction, but the current default is too heavy and too frosted compared with Apple's navigation glass.

Observed failure modes:

- large background text becomes oversized/smeared across most of the glass interior
- center region is too blurred
- refraction energy is spread too far inward
- chromatic separation is too visible in some high-contrast areas
- surface can read as a thick optical lens rather than a thin UI material
- tint/highlight can make the material feel milky rather than content-infused

The architecture is working. This task is about the material only.

---

# 1. Apple-like target characteristics

Tune the default material toward these characteristics:

### Center

- high transmission
- backdrop remains recognizable
- very low geometric displacement
- low-to-moderate scattering only
- no obvious RGB split
- minimal inherent white tint

### Mid region

- subtle optical bending begins
- mild scattering
- still visually connected to the real backdrop

### Edge / lip

- strongest displacement concentrated near the boundary
- crisp curved-lens effect
- narrow bright Fresnel/specular highlight
- subtle opposing darker/internal edge cue
- chromatic separation only as a tiny edge accent on strong contrast

The material should read as a **thin refractive UI surface**, not a magnifying lens or frosted acrylic panel.

---

# 2. Preserve current architecture

Do NOT change:

- `captureManager`
- overscan size/strategy
- scroll-delta source compensation
- `BackdropSourceState`
- capture scheduling
- generation/freshness protection
- WebGL canvas lifecycle
- fallback/device policy
- React provider structure
- public component layout

Do not use CSS blur to fake the target appearance.

The shader remains the primary rendering path.

---

# 3. Current shader areas to tune

Primary file: `src/renderer/shaders.ts`

Current important sections:

- `edgeWidth`
- `edgeBase`
- squared `edge` falloff
- `lipWidth`
- exponential `lip`
- `refractionStrength`
- `lensPixels`
- `scatteringProfile`
- `scatteringShape`
- `blurStep`
- chromatic `split`
- `fresnel`
- `specular`
- default tint mix

Do not rewrite the shader wholesale. Calibrate these terms.

---

# 4. Refraction profile — highest priority

Current screenshots show too much broad interior displacement.

Make the center substantially calmer while retaining obvious edge refraction.

Target qualitative profile:

```text
center 50-65% of thickness
    almost no displacement

next ~15-20%
    gentle bending

outer ~10-20%
    rapidly increasing displacement

very outer lip
    strongest but narrow optical kick
```

Use a steeper nonlinear edge falloff rather than simply lowering `u_refraction` globally.

The edge should bend a vertical/text boundary clearly when it crosses the surface, but a whole word should not appear magnified across the entire bar.

Recommended first experiment:

- reduce broad edge contribution in `lensPixels`
- make `edge` falloff steeper (`pow` exponent higher than current 2.0 if visually justified)
- keep/increase the narrow `lip` contribution only enough to preserve the glass boundary
- reduce the constant center floor (`0.004`) substantially; target near-zero center displacement

Do not compensate by adding more blur.

---

# 5. Blur/scattering — second priority

Current result looks too smeared on high-contrast typography.

The present shader enforces a minimum blur step and samples 5/9/13 taps depending on tier.

Tune so that:

- center is considerably clearer
- blur rises mildly toward the edge
- high-contrast text remains readable/identifiable through the center
- edge displacement is softened just enough to avoid aliasing
- material does not look frosted

Investigate reducing the minimum blur floor from the current effective value and making scattering depend more strongly on edge proximity.

Do not increase sample count unless visual improvement is substantial and benchmarked.

Prefer profile math over extra taps.

---

# 6. Chromatic aberration — subtle only

Current RGB separation should be reduced.

Target:

- effectively zero in center
- barely perceptible at ordinary edges
- visible only on strong high-contrast boundaries when inspected closely
- never obvious as red/blue ghost copies of text

Reduce both the split magnitude and/or channel mix if necessary.

The default should feel optical, not stylized.

---

# 7. Tint/transmission

Apple's default Liquid Glass is largely colorless and takes color from content behind it.

For the default preset:

- reduce inherent white tint if the surface feels milky
- favor backdrop transmission
- preserve underlying yellow/blue/orange colors naturally
- maintain foreground control legibility

The default `tintOpacity` should remain low. Do not solve legibility by turning the material into an opaque white panel.

Colored/stained glass can be a future variant, not the default.

---

# 8. Edge highlight / Fresnel

The current bright rim is directionally promising but should be more refined.

Target:

- narrow, clean highlight
- slightly stronger on one directional edge
- subtle darker opposing edge
- no uniform white outline
- no neon/plastic look

Tune Fresnel/specular independently from refraction.

The border should visually define the glass even over a white background, but not dominate it.

---

# 9. Surface geometry behavior

Preserve the current size-aware optical profile.

Shallow navigation bars should look thinner than large cards.

For a ~50-70px-tall header/footer:

- calm center
- narrow strong lip
- limited magnification

Do not make the default profile depend on one exact viewport or one exact surface width.

---

# 10. Use the provided screenshots as failure references

The recent screenshots show genuine glass but excessive visual weight.

Treat these as explicit anti-targets:

- large black text should NOT turn into a thick blurred band across nearly the full header
- giant white text should NOT look duplicated/magnified across most of the material
- RGB color fringes should NOT be immediately obvious

The correct result should still visibly bend the text at the glass edge while leaving the central backdrop much more legible.

---

# 11. Development-only comparison modes

Use the existing debug/demo setup.

Do not build a large control panel.

If useful, add only minimal temporary presets for visual comparison:

```text
current
apple-candidate
edge-mask
```

The final default should replace the old material only after visual acceptance.

Keep debug code out of the production public API unless genuinely useful.

---

# 12. Public material controls

Preserve the existing public controls:

- `refraction`
- `blur`
- `chromaticAberration`
- `tint`
- `tintOpacity`
- `borderRadius`

These already allow project-specific tuning without redesigning the shader architecture.

Do not add many raw shader coefficients to `GlassSurfaceOptions` during this task.

After the default is accepted, a future small preset API may be added separately (`regular`, `clear`, etc.).

---

# 13. Visual acceptance tests

Use the existing difficult demo backgrounds.

### Test A — giant black typography

Place giant black text behind a shallow mobile header.

PASS:

- text remains recognizable through the center
- only the edge/lip bends it strongly
- no full-width smearing
- no obvious RGB ghosts

### Test B — giant white typography over saturated background

PASS:

- glass picks up background color naturally
- white glyph edges bend at the glass boundary
- center stays relatively clear
- no thick magnifying-lens look

### Test C — concentric rings

PASS:

- rings bend clearly at entry/exit boundaries
- rings remain structurally coherent in the center
- no chaotic warping

### Test D — mostly white/light backdrop

PASS:

- surface remains visible due to narrow highlight/refraction
- does not become opaque white
- does not disappear entirely

### Test E — saturated footer/header

PASS:

- material takes on backdrop colors naturally
- foreground labels remain legible
- no muddy gray/frosted appearance

---

# 14. Performance regression guardrail

This visual task must not break the continuous-scroll POC.

After each meaningful shader change verify in Chromium:

```text
renderer: webgl2
webgl presentation: visible
source state while scrolling: scroll-compensated
captures this scroll gesture: 0
fallback: false
```

Frame time should remain close to the current POC baseline. Do not increase texture taps or add multipass rendering unless measured cost is negligible and visually necessary.

---

# 15. Implementation order

1. Read `AGENTS.md`, `OPTICAL_TUNING.md`, `NO_CSS_SCROLL.md`, and this file.
2. Do not touch capture/scroll architecture.
3. Record current shader constants so changes are reversible.
4. Reproduce the giant-text screenshot case.
5. Tune refraction spatial falloff first.
6. Make center displacement near-zero/subtle.
7. Preserve a narrow stronger edge/lip.
8. Reduce center scattering/blur.
9. Reduce chromatic split to a subtle edge-only accent.
10. Tune tint/transmission toward mostly colorless default material.
11. Refine Fresnel/specular rim.
12. Compare shallow mobile header, desktop header, and footer.
13. Run giant text/rings/white-background visual checks.
14. Verify continuous WebGL scroll POC did not regress.
15. Run typecheck/tests/build.
16. STOP and report the visual changes for manual review.

Do not proceed into capture-engine benchmarking, replenishment, Safari/Firefox work, presets, or public API expansion in this run.

---

# 16. Completion report

Report:

- exact shader constants/profile terms changed
- before/after displacement behavior
- before/after blur behavior
- before/after chromatic behavior
- tint/highlight changes
- whether giant text is now recognizable through center
- whether edge refraction remains obvious
- frame average/p95/worst
- confirmation continuous WebGL remained active during scroll
- confirmation zero DOM captures occurred during active scroll

Manual visual acceptance is required before considering the material final.
