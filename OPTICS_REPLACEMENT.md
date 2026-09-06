# Optics Replacement — Decisive Implementation Task

## Objective

Stop tuning the current custom optical shader incrementally.

The scrolling/source architecture is valuable and must be preserved. The optical material is the component to replace.

Target result: the existing demo should show unmistakable thick refractive glass with coherent bending of straight lines/text/background geometry, comparable in character to mature Liquid Glass implementations, while retaining this repository's continuous WebGL scroll-compensation architecture.

## Preserve exactly

Do not redesign or remove:

- DOM/backdrop capture pipeline
- oversized/overscan source texture strategy
- `captureScrollX/Y` and live scroll-delta UV compensation
- exact / scroll-compensated / invalid source states
- generation/race protection
- shared WebGL2 renderer/canvas architecture
- React `GlassProvider` / `GlassSurface` structure
- continuous WebGL during scroll
- CSS stable-session fallback
- existing diagnostics

The optical shader may be replaced substantially.

## Upstream implementations to inspect

### 1. `naughtyduk/liquidGL`

Primary production/reference implementation for DOM-backed WebGL glass.

Upstream: https://github.com/naughtyduk/liquidGL
NPM package: `liquid-gl`

Inspect its current license before copying or vendoring any source. If current upstream is permissively licensed for this use, port only the optical/material implementation needed rather than replacing our working source/scroll architecture wholesale.

Study at minimum:

- rounded glass geometry / mask
- bevel/depth model
- refraction/displacement field
- frost/blur treatment
- specular treatment
- edge/depth treatment
- exposed parameters and defaults

### 2. `archisvaze/liquid-glass`

Visual/physics reference:

https://github.com/archisvaze/liquid-glass

Its WebGL demo demonstrates the target optical behavior particularly clearly: rounded SDF, thickness/bezel, surface-height/slope-derived refraction, IOR-style control, coherent backdrop displacement, specular/rim and tint.

Do NOT copy source from this repository unless its current license explicitly permits it. If no permissive license exists, use it only as a behavioral/physics reference and independently implement the underlying optical principles.

## Implementation strategy

Do not install another complete renderer on top of ours unless a minimal spike proves direct composition is clearly superior.

Preferred architecture:

```text
our DOM capture
  -> our overscanned source texture
  -> our scroll-delta source coordinates
  -> NEW proven/physics-based optical displacement shader
  -> our shared WebGL renderer
```

The new shader must operate on the source UV produced by our existing source-management/scroll-compensation system.

Separate two coordinate transformations explicitly:

1. **source alignment** — maps current page position into the overscanned captured texture; owned by our existing scroll system
2. **glass optics** — applies local lens displacement/refraction inside the glass surface; owned by the new material

Do not mix these responsibilities.

## Required optical model

The replacement must produce coherent geometry deformation, not merely blur/tint plus a border.

At minimum implement:

- rounded-rectangle signed-distance field or equivalent glass shape
- normalized distance/depth into the glass body
- curved virtual surface / surface-height profile
- gradient/surface normal from that profile
- refraction displacement derived from surface slope and configurable IOR/refraction strength
- configurable thickness/depth
- configurable bevel width
- restrained blur/frost independent of geometric displacement
- specular/rim highlight
- subtle inner depth/shadow
- tint independent of refraction

The center and edge must be parts of one coherent virtual lens. Straight lines behind the glass must visibly bend according to the surface, especially near bevels/endcaps, rather than simply becoming blurry.

## Public controls

Expose meaningful material controls rather than obscure shader constants. Prefer:

- `thickness`
- `bevelWidth`
- `ior` or a clearly named `refraction`
- `frost` / `blur`
- `specular`
- `tint`
- `tintOpacity`
- `borderRadius`

Maintain backward compatibility where inexpensive; otherwise map existing `refraction`, `blur`, `chromaticAberration`, `tint`, and `tintOpacity` onto the new model and document the mapping.

Chromatic aberration is secondary. Do not use it to fake refraction.

## Visual acceptance test

Use the existing demo plus an explicit optics test region containing:

- thick straight horizontal bands crossing the glass
- straight vertical bands crossing the glass
- large black typography
- saturated image/background detail

A passing result must make geometric refraction obvious in a still screenshot.

Pass:

- lines bend coherently through the glass volume
- rounded ends/corners visibly alter the displacement direction
- glass has perceivable optical thickness
- center remains recognizably related to the underlying scene
- blur is secondary to refraction
- no simple translucent-panel appearance
- no broad arbitrary smear

Fail:

- effect is mostly blur/tint
- straight geometry remains straight except for a tiny edge ripple
- a bright CSS-like outline supplies most of the glass impression
- background becomes an incoherent magnified smear

## Performance/correctness acceptance

The optics replacement must not regress the proven scrolling behavior:

- WebGL before/during/after scroll
- zero DOM captures during the POC scroll gesture
- valid `scroll-compensated` source state while inside overscan
- no CSS presentation during capable-mode test
- no new canvas/context per surface
- no per-frame GPU resource allocation

Do only focused Chromium regression for this task. Do not spend this run on Safari/Firefox/mobile qualification or capture-engine benchmarking.

## Work order

1. Read this file and `AGENTS.md`.
2. Inspect the current shader only enough to identify integration points; do not continue parameter tweaking.
3. Inspect current upstream `naughtyduk/liquidGL` implementation and license.
4. Inspect `archisvaze/liquid-glass` WebGL optics as a visual/physics reference and verify its license before any code reuse.
5. Choose the shortest legally safe route: port permissively licensed optical code where appropriate and/or independently implement the same physical model.
6. Replace the current displacement/material core while preserving our source-coordinate/scroll system.
7. Add meaningful thickness/bevel/IOR-style parameters.
8. Tune one default preset to visibly thick, coherent liquid glass.
9. Run the explicit straight-line/typography visual test.
10. Run the focused continuous-scroll Chromium regression.
11. STOP for manual visual review.

Do not spend time trying another incremental tweak to the old shader. The purpose of this task is to replace the optical model.

## Completion report

Report only:

- which upstream implementation/code was reused, if any, and its verified license
- which optical model was implemented
- files changed
- default thickness/bevel/IOR/frost/specular values
- visual test result
- continuous-scroll regression result
- exact command/URL for manual review
