# Toolcraft App Agent Worklog

## Status

Mode: product

Sol is a poster of one day of sunlight at a chosen place: the sun's elevation through 24 local hours with twilight bands, the day length, sunrise, sunset, solar noon, golden hour and civil twilight, the sun at a chosen time, and day length through the whole year. Times use the place's own time zone. Detailed requests and results belong in `docs/agent-journal/changes`; command attempts live in `.toolcraft/journal/runs`.

Active change: sol-rebuild-0026

## Decision Trail

### Change sol-rebuild-0026 — Rebuild Sol on Toolcraft 0.0.26 with a new design

- Change ID: sol-rebuild-0026
- Request: "Yes do it for those and all others to make it consistent and the sites are too old and not well designed so we want to avoid that in the future make it much better ok?" (follow-up to an offer to regenerate Sol on Toolcraft 0.0.26 and port it). The user then chose: all seven Toolcraft apps, sol first; each app keeps its own look; rethink freely; no check-ins.
- Task type: Generated app porting plus substantial product redesign (renderer, controls, export).
- User-visible result: A new poster design. Left column: place and UTC offset, date, a large serif day length, and rows for sunrise, sunset, solar noon with elevation, golden hour, civil twilight and the sun at the chosen time with compass direction. Right: a true elevation curve over 24 hours with shaded civil/nautical/astronomical twilight bands, a golden daylight area, the sun at the chosen time, and a year strip of day length with the day marked. The frame opens fitted beside the controls.
- Source/reference checked: The previous Sol (github.com/parthchandak02/sol at 686f387, Toolcraft template from July 2026) and its live site sol.parthchandak.info; the upstream example `examples/polar-signals` (github.com/pixel-point/toolcraft) for 0.0.26 wiring patterns.
- Reference inputs: None (no motion, video, Figma or screenshot reference; the earlier Sol informed the subject only).
- Docs/contracts read: AGENTS.md, workflow.md, core/runtime-boundary.md, assembly-workflow.md, core/control-selection.md, core/layout.md, core/performance.md, core/setup-export.md, core/media-upload.md, core/development-files.md, core/app-cover.md, core/slider-ranges.md, decision-contract.md, schema-reference.md, component-rules.md, renderer-technique.md, performance.md, acceptance-testing.md.
- Contract rules applied: runtime-shell-required (product only in `app-schema.ts`, `app-composition.tsx` and `src/sol/*`), canvas-no-app-ui (all text on the poster is product text), canvas-surface-preserved (transparent foreground; the runtime paints Background), infinity-canvas-scene-bounds (finite artboard provider; the raster pass declares intrinsic bounds), output-export-required (image only), controls-section-inventory-required, acceptance-product-observable, persistence-policy-explicit (default local persistence).
- View interaction intent: non-spatial; the output is a two-dimensional chart and typography.
- Interaction ownership: every operation lives in the panel. Latitude, longitude, day and time are global property edits; city, season and Now are panel commands. The canvas has no handles; a canvas copy would cover the poster and add nothing.
- Decision: Compute the sun locally with the NOAA solar calculator instead of calling the Sunrise-Sunset API. Show a true elevation curve instead of a stylised arc. Add a Time of day slider and a Now command so the sun can be placed at any moment. Add season shortcuts and a Tromsø preset to show the midnight sun and polar night. Rasterize in a worker so the backing follows zoom exactly. Save a fitted default view (50% zoom, shifted left of the panel) with Save State as Default.
- Alternatives rejected: Keeping the API (network dependency, no time zone, coarse fallback); a reference-runtime clone of the old Sol (the user asked for a redesign); SVG output (needs a second raster path for PNG/JPG); a main-thread raster pass (the contract only allows rerasterizing on zoom off the main thread); a product hook that fits the view on every load (it would fight the user's persisted zoom).
- State/output mapping: `place.latitude` and `place.longitude` set the place for the solar model and, when they match a city, its IANA time zone; `date.dayOfYear` and `time.hour` choose the day and the sun's moment; `place.city`, `date.season` and `time.moment` dispatch `controls.setValue` for those sliders; `appearance.background` sets the runtime background and the poster's ink (dark ink on light backgrounds, warm white on dark); `export.includeBackground` removes the runtime fill and makes PNG transparent; `canvas.size.*`, `canvas.renderScale` and `canvas.zoom` set the worker raster's backing; `export.image.*` feed the runtime image export, which calls the same `drawSol` through `scene.rasterFrameRenderer`.
- Verification: Unit tests in `src/sol/sol.test.ts` (20 passed; New York June solstice sunrise and sunset within two minutes of NOAA, polar night and midnight sun at Tromsø). All product browser specs passed during development: `product-sol-controls`, `product-sol-appearance`, `product-sol-canvas`, `product-sol-export`, `product-sol-persistence`, `app-controls`. Screenshots checked by the agent at 1440x900 for the default, Tromsø midnight sun and a dark-background Sydney poster. The first-delivery gate result is recorded below.
- Risks: See Risks.

## Decisions

### Renderer

- Decision: Canvas 2D drawn in a worker (OffscreenCanvas) through one `raster` pipeline pass; the export pass calls the same `drawSol` on the runtime-supplied context.
- Reason: A few hundred strokes and a dozen text runs; one drawing function keeps preview and export identical, and the worker allows exact zoomed backing without main-thread rasterization.
- Evidence: `src/sol/sol-pipeline.ts`, `src/sol/SolCanvas.tsx`, `src/sol/sol-export.ts`; `browser: sol backing preserves selected render scale`.

### View Interaction

- Decision: Mode `non-spatial`.
- Reason: The poster is flat; nothing rotates.
- Evidence: `src/sol/sol-inventory.ts` `viewInteraction`.

### Interaction Ownership

- Decision: Panel only, nine entries (six property edits, three commands).
- Reason: All inputs are single global values or shortcuts; the canvas stays clean for the poster.
- Evidence: `src/sol/sol-inventory.ts` `interactionOwnership`.

### Timeline

- Decision: No timeline.
- Reason: A still poster; time of day is a slider, not playback, and video was not requested.
- Evidence: No timeline module in `app-schema.ts`; `animationIntent: none`.

### Layers

- Decision: No layers.
- Reason: No layer workflow was requested.
- Evidence: No layers module.

### Controls

- Decision: Settings (runtime background pair), Place (Latitude, Longitude, Cities), Moment (Day of year, Seasons, Time of day, Now), Image Export (runtime).
- Reason: Place and moment are the two independent inputs; shortcuts sit beside the sliders they set.
- Evidence: `src/sol/sol-controls.ts`, `appControlSectionInventory`; browser specs click every city and season and drag every slider while held.

### Export

- Decision: Image export only (PNG/JPG at 2K, 4K, 8K) through `imageExportModule()` and `scene.rasterFrameRenderer`.
- Reason: Toolcraft default; SVG and video were not requested.
- Evidence: `browser: sol image export delivers every format and size` decodes every format and size and checks the sun pixel and content bounds.

### Performance

- Decision: Workload envelope from runtime state only (canvas width/height, render scale, zoom) plus export resolution; derived paths via `deriveToolcraftPerformancePaths`; adapters in `e2e/app-performance-path-adapters.ts`.
- Reason: No product control changes render cost; cost follows backing size, and the worker coalesces to the newest request.
- Evidence: `src/sol/sol-performance-model.ts`; `sol render plan has valid derived paths and fixtures`. First delivery runs no measured performance by contract.

Canonical control values and selected-entity isolation follow runtime representations; render scale has functional `renderScaleCoverage` with backing-pixel proof.

## Evidence

- Source reviewed: previous Sol, upstream polar-signals example, local Toolcraft docs.
- Contract applied: product modules under `src/sol`, registered browser scenarios in `e2e/product-sol-*.spec.ts`, cover at `public/toolcraft/cover.png` with `app-cover.json` and `app-cover-state.json`.

## Verification

Protected receipts own initial proof. Development checks: `src/sol/sol.test.ts` 20 passed; product browser specs passed; agent screenshots of three contrasting states inspected. Cover captured with the app's own Export PNG at 4K (4096x2304) from the default state.

## Risks

- Risk: Places that do not match a city preset use the nearest whole-hour UTC offset from longitude, which can differ from the legal time zone; the poster labels it as UTC±N so it is not mistaken for a named zone.
- Risk: Canvas fonts depend on the viewer's system serif; the layout uses fallbacks (Iowan Old Style, Palatino, Georgia) and was checked with Chromium's defaults.
