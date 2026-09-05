# Architecture decisions

## ADR-001 — WebGL2, not SVG backdrop displacement

Cross-browser real refraction is the acceptance criterion. SVG displacement
inside backdrop-filter cannot be the primary renderer because support differs
across browser engines. CSS blur remains fallback only.

## ADR-002 — One shared renderer

All active glass surfaces register with one renderer. A desktop header or the
mobile header/footer layout should not create independent WebGL contexts.

## ADR-003 — DOM capture is client-side

Backdrop rasterization happens in the visitor's browser. No server-side image
capture is required, so this architecture should not add meaningful rendering
load to the application server.

## ADR-004 — Adaptive quality measures reality

Do not rely on exact device names. Capability hints may seed the initial quality,
but sustained frame time and capture duration determine downgrade/upgrade.

## ADR-005 — Narrow scope before generic abstraction

First make desktop header, mobile header and mobile footer excellent. Only widen
the API after a second real use case proves the abstraction.
