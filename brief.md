# sol — Creative Brief

## Concept
Interactive sun path visualization. Explore how the sun's daily arc across the sky changes by latitude and season. Move a slider from New York to Singapore to Reykjavik and watch the sun's path tilt, stretch, and shift. A pastel sky canvas shows the sun's arc, golden hour glow, and real-time sunrise/sunset/civil twilight data from the Sunrise-Sunset API.

**Metaphor family:** journey (sun's daily arc across the sky)
**Narrative Pattern:** Annotation (each data point carries day-length context)
**Tier 2 Patterns (pick 2):** Hero Number (day length in H:MM format) + Quiet Zone (tap reveals sunrise/sunset/noon/twilight times)

## Data Source
- API: https://api.sunrise-sunset.org/json?lat={lat}&lng={lng}&date={date}&formatted=0
- Response fields used: sunrise, sunset, solar_noon, day_length, civil_twilight_begin, civil_twilight_end
- Fallback: Use typical day-length values for the latitude/longitude pair. Pre-compute estimated values if API fails.
- Poll interval: API is called on slider/control change, not periodically. Passive data.

## Visual Style
- Preset: Light — Breeze (pastel sky, soft blue/pink/lavender)
- Background: Pale sky blue #e8f4f8, gentle radial gradient to #d4ecf0 at edges
- Palette:
  ```js
  const PALETTE = {
    bg: '#e8f4f8',
    depth: '#d4ecf0',
    sunColor: '#ffd54f',     // warm golden sun
    sunGlow: '#ffecb3',      // pale golden glow
    arcColor: '#81d4fa',     // soft blue arc path
    arcHighlight: '#4fc3f7', // brighter arc segment (daylight portion)
    twilightColor: '#ce93d8', // soft lavender twilight glow
    text: 'rgba(0,0,0,0.5)',
    textBold: 'rgba(0,0,0,0.7)',
    horizon: 'rgba(0,0,0,0.08)',
  };
  ```

## Three Dials
- DESIGN_VARIANCE: 3 (predictable — sun path is a calculated arc, positions are precise)
- MOTION_INTENSITY: 6 (gentle — animated transitions when slider changes, smooth sun movement)
- VISUAL_DENSITY: 3 (sparse — one sun, arc path, horizon line, labels, chrome)

## Encoding Contract
| Data Field | Visual Channel | Range | Inverse Function | "Bigger means..." | Legend? |
|------------|----------------|-------|------------------|-------------------|---------|
| solar_noon altitude (computed from lat/date) | sun height above horizon | 0-90deg | invertScale(height, 0, H/2, 0, 90) | higher sun in sky | no (physical) |
| day_length (seconds) | arc sweep angle (visible daytime portion) | 0-86400 | invertScale(sweep, 0, PI, 0, 86400) | longer day | no (physical) |
| sunrise time | left endpoint of arc on horizon | dawn time | based on pixel position | earlier sunrise | no (physical) |
| sunset time | right endpoint of arc on horizon | dusk time | based on pixel position | later sunset | no (physical) |
| latitude | arc tilt/stretch | -90 to 90 | invertScale(y, 0, H, -90, 90) | more extreme seasons | yes (label on preset buttons) |
| civil_twilight_before/after | golden hour glow gradient on horizon | before sunrise / after sunset | visual gradient area | longer twilight | no (visual) |

## Interaction
- Latitude slider (-90 to 90) — adjust the location latitude. Arc tilts visibly.
- Longitude slider (-180 to 180) — changes timezone, affects sun position timing.
- Date slider (day 1 to 365) — seasonal changes. Arc stretches (summer) and shrinks (winter).
- Preset city buttons: New York (40.7), London (51.5), Tokyo (35.7), Sydney (-33.9), Singapore (1.3), Reykjavik (64.1), Cape Town (-33.9)
- Tap on canvas: open Quiet Zone with exact sunrise/sunset/noon/twilight times and day length
- Auto-animation: gentle pulsing glow on the sun, smooth transitions on slider changes

## Communication Requirements
**Tier 1 (mandatory):**
1. Persistent Data Stamp — "Sunrise-Sunset API · {lat}°, {lng}° · live · updated Xs ago"
2. Data Process Honesty — fallback labeled "fallback", never "live"
3. One-to-One Sensory Mapping — sun height = altitude, arc length = day length. Obvious physical metaphors.

**Tier 2 (pick 2):**
4. Hero Number — day length in H:MM format at 48px top-left, with "day length" label below at 11px
5. Quiet Zone — tap reveals exact UTC sunrise/sunset/solar noon/civil twilight times + day length seconds. Fades after 3s idle.

**Coherence:**
6. Generative-art axes: one strokeWeightScale (horizon=1, arcPath=2, gridLines=0.5), alphaHierarchy (bg=1, field=0.8, active=0.95, label=0.5), shapeLanguage (organic curves)
7. Motion tokens: --motion-fast:160ms, --motion-base:240ms, --motion-slow:360ms, --ease-out-expo
8. AI Slop Score < 30 — system-ui font, layered bg gradient, at least 1 animation (sun pulse). No Inter/Roboto/Open Sans. No purple gradient default.

## Canvas Code Requirements (MANDATORY)
1. Single No em-dashes — use hyphens for all text labels.
2. Config object `C` at top with all tunable values
3. DPR-aware canvas setup using setTransform
4. Canvas CSS: position:fixed; top:0; left:0; width:100%; height:100%; display:block
5. Touch guard pattern
6. First frame never blank — seed with default lat/lng/date values
7. Fallback data: compute sun position using solar position algorithm if API fails
8. system-ui, sans-serif font for all chrome text
9. Full-viewport, mobile-responsive
10. .nojekyll file at project root

## Toolcraft Controls Schema
Controls panel (right sidebar):
- Latitude slider: -90 to 90, default 40.7 (NYC), step 0.1
- Longitude slider: -180 to 180, default -74.0 (NYC), step 0.1
- Date slider: day of year 1-365, default today's day
- Preset buttons (segmented or row of buttons): NY, London, Tokyo, Sydney, Singapore, Reykjavik, Cape Town
- Day number display: shows current day number + date string

## Required Component Structure (Toolcraft)

### src/App.tsx — Route
Wire ToolcraftApp with schema and canvasContent. Position chrome overlays (hero, stamp, legend, desc, quiet zone) as fixed-position siblings. Handle panel actions (triggerPreset, resetView).

### src/route/sol/schema.ts — Toolcraft Schema
Controls: lat slider, lng slider, date slider. Sections with labels.
Button controls for preset cities that set lat/lng.

### src/route/sol/SunPathCanvas.tsx — Canvas Renderer
DO NOT USE TOOLCRAFT'S CANVAS COMPONENT — write a standalone canvas component.
Renders:
- Pastel sky background with radial gradient
- Horizon line (thin, muted)
- Sun path arc (full 180deg arc from left to right horizon, blue)
- Day-time portion of arc highlighted (brighter blue)
- Twilight glow gradients at left/right edges
- Sun sphere at current position along the arc (golden, with radial glow)
- Time labels (sunrise, sunset, noon, current time) along the arc
- Pulsing sun glow
- Animated transitions when lat/date changes

### Chrome overlays (positioned outside ToolcraftApp, fixed position):
- #hero: top:24px left:24px — 48px day length in H:MM format, 11px "day length" label
- #stamp: bottom:20px left:16px — 10px system-ui "Sunrise-Sunset API · 40.7°, -74.0° · live"
- #legend: bottom:44px center — 9px system-ui show arc color, twilight color, sun dot
- #desc: bottom:68px center — 11px system-ui "Latitude and season shape the sun's arc — drag sliders to explore"
- #quiet-zone: floating center panel — reveals on tap, shows all times, fades after 3s

## Interaction Affordances
- Sun has a gentle pulse glow (sine wave opacity 0.7-1.0, period 2s)
- Arc path subtly visible even without data (full theoretical arc)
- Tap opens quiet zone with exact times
- Slider changes animate smoothly (spring easing, 500ms)

## Render tier
toolcraft — Pixel Point Toolcraft + Vite, Cloudflare Pages deploy
Slug: sol
URL: https://sol.parthchandak.info
