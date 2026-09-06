# Optical Tuning Plan

## Status

Milestone 3: **PASSED in Chromium on 2026-09-06 — Apple-like optical calibration**

Milestones 1 and 2 are considered architecturally successful in Chromium:

- zero DOM captures during active scroll
- smooth interaction path
- one coalesced settled capture
- stale/obsolete texture generations cannot be intentionally revealed
- WebGL returns only after a current-generation texture is uploaded and drawn

Do not rewrite the capture scheduler, texture-generation system, or interaction-state architecture during this milestone unless a new reproducible correctness bug proves that one of those systems is wrong.

This file remains the implementation plan and verified completion record for the visual-quality milestone.

---

# 1. Current visual observation

The current renderer is producing genuine WebGL refraction, but the effect is too aggressive for shallow navigation surfaces.

Observed on the mobile header:

- very large typography behind the header becomes stretched/duplicated across much of the glass height
- displacement occupies too much of the interior instead of being concentrated toward the boundary
- the center of the glass feels more distorted than Apple's navigation glass typically does
- the effect reads as a strong optical lens rather than a thin premium UI material

Observed on the mobile footer:

- color pickup is attractive
- edge highlight/lip is convincing
- the translucent yellow/orange backdrop reads as glass
- content remains readable
- distortion appears more visually balanced than the header

This suggests the renderer is fundamentally working, but refraction strength and its spatial profile need calibration.

---

# 2. Visual target

The goal is not a physically perfect glass simulation.

The target is a perceptually convincing Apple-like UI material:

```text
CENTER
- mostly transmitted backdrop
- gentle blur/scattering
- low displacement
- content behind remains recognizable

MID REGION
- subtle bending
- slightly increased scattering
- mild tint

EDGE / LIP
- strongest displacement
- brighter Fresnel/specular response
- optional subtle chromatic separation
- visually crisp boundary
```

The material should feel like a relatively thin optical surface rather than a thick magnifying lens.

---

# 3. Critical requirement: preserve architecture

Do NOT solve visual tuning by:

- changing DOM capture cadence
- reintroducing captures during scrolling
- weakening the texture freshness contract
- disabling generation checks
- increasing screenshot refresh frequency
- replacing WebGL with permanent CSS blur
- adding one renderer per surface

Milestone 3 is shader/material tuning only, plus minimal surface-option changes if necessary.

---

# 4. Tune by normalized glass thickness

The current shader derives lens displacement from the surface's smaller dimension. That is useful, but shallow horizontal navigation bars require special care.

A surface such as:

```text
440 x 56 px
```

should not behave optically like a thick card.

Introduce or derive a normalized thickness/profile factor so shallow pills receive a thinner optical treatment.

Possible conceptual inputs:

```ts
aspectRatio = width / height
thickness = min(width, height)
normalizedThickness = clamp(thickness / referenceThickness, ...)
```

Do not hardcode only one viewport size. The behavior should scale across desktop and mobile navigation dimensions.

Desired result:

- shallow header/footer: thin-lens treatment
- larger panel/card: somewhat deeper refraction may be allowed

Primary library use remains headers and mobile navigation/footer.

---

# 5. Refraction spatial profile

The main tuning goal is to move strong displacement toward the edge.

Current visual behavior suggests too much refraction energy extends into the interior.

Experiment with a profile where displacement approximately behaves like:

```text
0% edge distance     -> strongest lensing
10-20% inward        -> noticeable lensing
20-40% inward        -> rapidly decaying lensing
center               -> very low displacement
```

Do not use these percentages as fixed truth; tune visually.

Prefer smooth nonlinear falloff rather than a hard ring.

Candidates:

- steeper `smoothstep`
- exponential decay
- polynomial edge curve
- separate broad-body and narrow-lip terms with much weaker broad-body contribution

The edge should still visibly bend lines/text when they cross it.

---

# 6. Reduce repeated/duplicated typography appearance

High-contrast large text is the best stress test.

Place large letters partly behind the glass and tune until:

- the boundary clearly bends the glyph
- the glyph does not appear copied several times across the full surface
- the center still corresponds recognizably to the underlying glyph
- displacement direction feels coherent rather than smeared

Do not hide this test by making the demo background visually easy.

Keep strong typography and geometric shapes in the demo specifically to expose optical errors.

---

# 7. Blur and scattering

Apple-like glass should not look like simple Gaussian blur, but some scattering is useful.

Tune blur only after refraction profile is under control.

Goals:

- enough scattering to soften harsh displaced pixels
- preserve recognizable backdrop structure
- no foggy/frosted-glass appearance unless intended by tint/size
- shallow navigation glass should remain relatively clear

Do not increase blur merely to conceal excessive refraction.

HIGH/MEDIUM/LOW tiers may retain different tap counts, but the perceived material should remain consistent between tiers.

---

# 8. Fresnel / edge highlight

The current bright edge is promising.

Tune it so:

- top/leading edge receives a restrained bright highlight
- opposite edge may receive a subtle darker/internal-shading cue
- highlight should not become a uniform white border
- highlight intensity should react to the derived surface profile/thickness
- footer/header should feel like the same material

Avoid a plastic/neon outline.

---

# 9. Chromatic aberration

Keep chromatic separation subtle.

It should be most visible:

- near highly refractive edges
- on high-contrast transitions

It should not be obvious in the center.

If the user can immediately identify red/blue ghosting everywhere, it is too strong.

LOW quality may continue disabling it.

---

# 10. Tint and transmission

Tune tint independently from refraction.

Target behavior:

- backdrop color still contributes substantially
- white/light tint lifts the material without washing it out
- footer should pick up strong underlying colors naturally
- header over white/blue/black content should remain legible

Avoid making the surface look like a semi-opaque white card.

A good default should work on both light and saturated demo sections.

---

# 11. Surface-size adaptation

Use size/aspect-aware optical tuning rather than forcing identical lens depth everywhere.

At minimum visually compare:

```text
mobile header   ~ 440x56
mobile footer   wider shallow pill
normal medium card/panel
wide desktop header
```

The library should preserve one coherent material while adapting apparent thickness.

Desired behavior:

- shallow UI surfaces -> restrained refraction
- somewhat larger surfaces -> slightly more scattering/depth
- never allow huge magnification-like distortion by default

---

# 12. Default preset

Create one excellent default preset first.

Avoid exposing dozens of new public parameters.

The public API should remain simple.

If internal constants need to become structured, prefer an internal material profile such as:

```ts
APPLE_LIKE_DEFAULT
```

or equivalent.

Only expose a small number of meaningful controls if necessary, for example:

- refraction/intensity
- tint/tintOpacity
- blur/scattering

Do not make consumers tune 15 shader coefficients.

---

# 13. Demo controls for tuning

Keep diagnostic controls development-only.

Useful temporary tuning modes may include:

```text
normal
sample
exaggerated
edge-mask
refraction-only
highlight-only
```

Add these only if they materially help calibration.

Do not let debug modes complicate the production API.

A very useful debug view would visualize the edge/refraction strength as grayscale so we can see whether most displacement is truly concentrated near the boundary.

---

# 14. Acceptance scenarios

## A. Large typography behind mobile header

Place a very large high-contrast word crossing behind the header.

PASS:

- clearly refracted at the edge
- center remains recognizable
- no obvious multiple-copy/smear appearance across the full header
- glass still looks optically active

## B. Concentric rings / geometric shapes

Use the existing rings and colored geometry.

PASS:

- rings visibly bend entering/exiting the surface
- bending direction is coherent
- no chaotic stretching

## C. Saturated footer backdrop

Stop with orange/yellow/blue content behind the footer.

PASS:

- natural color pickup
- readable navigation labels
- bright glass lip remains controlled
- effect feels premium rather than foggy

## D. Mostly white backdrop

PASS:

- glass remains visible through edge/highlight/tint
- does not become an invisible transparent rectangle
- does not become an opaque white card

## E. Desktop header

PASS:

- same material language as mobile
- no exaggerated magnification over text
- refraction remains obvious enough to distinguish it from CSS blur

## F. Scroll regression

After every meaningful shader/material change:

- continuous scroll remains smooth
- captures during active scroll remain zero
- no stale texture flashes

Any regression here blocks the optical change.

---

# 15. Quantitative guardrails

Visual quality is primary for this milestone, but do not introduce substantial GPU cost without measurement.

Keep an eye on:

- average frame time
- p95 frame time
- worst frame time
- shader quality tier
- number of texture samples

Do not add expensive multi-pass rendering merely for subtle visual improvement unless benchmarked and justified.

Prefer better math/profile shaping over more samples.

---

# 16. Recommended implementation order

1. Read `AGENTS.md`, `PERFORMANCE_PLAN.md`, and this file.
2. Treat Milestones 1 and 2 as frozen architecture.
3. Record current shader constants and current default surface options.
4. Reproduce the large-text mobile-header case.
5. Add a debug visualization for refraction/edge strength if useful.
6. Reduce broad/interior displacement.
7. Concentrate strong refraction toward the lip/edge.
8. Add size/aspect/thickness adaptation for shallow surfaces.
9. Tune broad lens term versus narrow edge-lip term.
10. Re-test large typography and rings.
11. Tune blur/scattering.
12. Tune Fresnel/specular edge response.
13. Tune chromatic aberration.
14. Tune tint/transmission.
15. Verify mobile header, mobile footer, and desktop header all read as one material.
16. Run build/tests.
17. Re-run scroll/freshness regression checks.
18. Update README/BENCHMARK with the final default material behavior.

Do not stop at a written plan. Implement and visually test the milestone.

---

# 17. Completion report

## Verified implementation

- Changed `src/renderer/shaders.ts` for the material profile and added an `edge-mask` diagnostic through `src/types.ts`, `src/renderer/GlassRenderer.ts`, and `examples/main.tsx`.
- Replaced the broad displacement floor and 72%-of-half-thickness edge band with a normalized-thickness/aspect profile, squared edge falloff, narrow exponential lip, and an almost calm center.
- A 440×56 shallow surface receives about 0.08 px center displacement and about 2.4 px peak normal displacement at the rim at the default refraction setting; larger/thicker surfaces retain proportionally more depth up to the internal 96 px reference thickness.
- Scattering and chromatic separation now follow the same optical/edge profile. Tint and public defaults were unchanged. No named internal or public preset was introduced; the profile is derived per surface.
- HIGH/MEDIUM/LOW sample counts remain 13/9/5 scattering taps; HIGH and MEDIUM retain the existing two chromatic samples.
- Large typography, rings, saturated footer backgrounds, mostly white backgrounds, and the desktop header passed manual Chromium inspection. Ten arbitrary mobile stops showed current, aligned content with no stale-frame flash.
- A 6.1-second continuous scroll and a 4.9-second aggressive bidirectional scroll both produced zero captures during interaction and one capture after settle. Rapid stop/start plus mutation and resize-storm tests also coalesced to one settled refresh with matching generations.
- Mobile settled capture time was 81.7–89.7 ms. Active-scroll rolling average was 8.3–9.1 ms; p95 was normally 9.0–9.2 ms and reached 16.6 ms; worst was 25.0 ms. These long intervals were not filtered.
- TypeScript, all 15 unit tests, the production demo build, and npm audit passed. Chromium was tested; Safari and Firefox remain unverified.

---

# 18. Next milestone after optical tuning

Do not start this automatically.

After the default optics are satisfactory, the likely next work is:

- Safari validation
- Firefox validation
- real integration into Delivery Market header/footer
- package/release cleanup
- optional capture-zone research to reduce the remaining idle rasterization cost

Those are separate milestones.
