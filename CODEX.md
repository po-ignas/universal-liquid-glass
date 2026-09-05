# Codex working rules

Before implementing a non-trivial capability:

1. Inspect the existing package architecture.
2. Research whether a mature permissively licensed implementation already solves
   the difficult generic part.
3. Prefer integrating/adapting proven work over rewriting solved engineering.
4. Verify LICENSE before copying source; preserve required notices.
5. Do not silently replace real refraction with blur and call the task complete.
6. Chromium is a primary acceptance browser. Safari and Firefox are also required.
7. Page performance has higher priority than glass quality.
8. Do not change unrelated architecture or application-specific behavior.
9. Test resize, scroll, DPR changes, responsive layout switches, stacking contexts,
   overflow/clipping and reduced-motion behavior.
10. Keep normal interactive content in the DOM for accessibility.

## Acceptance principle

If refraction is not visibly working in Chromium, the implementation is not done.
If the effect materially worsens interaction/scroll performance, automatically
reduce capture/render quality before accepting the result.
