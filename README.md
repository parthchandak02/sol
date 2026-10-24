<div align="center">

<h1>Sol</h1>

<p><b>The sun's daily arc, by latitude and season.</b></p>

<p><i>Slide from the equator to the Arctic, or from June to December, and watch the day stretch and shrink.</i></p>

<h6>

![Data](https://img.shields.io/badge/data-Sunrise--Sunset%20API-ffd54f?style=flat-square)
![Canvas 2D](https://img.shields.io/badge/Canvas-2D-111111?style=flat-square)
![React](https://img.shields.io/badge/React-19-111111?style=flat-square&logo=react&logoColor=white)
![Live](https://img.shields.io/badge/live-sol.parthchandak.info-4fc3f7?style=flat-square)
![Status](https://img.shields.io/badge/creative%20daily-experiment-555555?style=flat-square)

</h6>

<a href="https://sol.parthchandak.info"><b>Live demo</b></a> ·
<a href="#how-it-works"><b>How it works</b></a> ·
<a href="#run-it"><b>Run it</b></a>

<br><br>

<a href="https://sol.parthchandak.info"><img src="docs/assets/readme/hero.jpg" width="100%" alt="A pale blue sky framed in black with a wide arc across it, a long bright blue daytime segment with lavender twilight ends, a yellow sun parked at sunrise, 10h 48m day length top-left and a dark controls panel with location and date sliders and seven city preset buttons on the right"></a>

<sub>Live capture, 23 October 2026, night in New York so the sun waits at sunrise. Real API data.</sub>

</div>

<br>

A pastel Canvas 2D sky with one arc across it. Three sliders set latitude, longitude and day of
the year, and seven city buttons (New York, London, Tokyo, Sydney, Singapore, Reykjavik, Cape
Town) jump the location sliders; the arc and the big day-length number top-left follow. Sunrise, solar noon, sunset and
civil twilight come from the free [Sunrise-Sunset API](https://sunrise-sunset.org/api), so no key
is needed. It opens on New York and today's date.

## How it works

| Input | Drives |
|---|---|
| Solar noon altitude, from latitude and the sun's declination on that day | How high the arc rises |
| Day length, from the same formula | How much of the arc is lit blue as daytime |
| API `civil_twilight_begin` / `_end` | The lavender bands either side of daytime, and the outer time labels |
| API `sunrise`, `solar_noon`, `sunset` | The time labels under the arc |
| The time of day now, against the selected day's sunrise and sunset | Where the sun sits on the arc (parked at sunrise or sunset at night) |

The arc is a stylised curve, not a true azimuth and elevation plot. Arc height and the daytime
share are computed in the browser; the clock times come from the API, with a computed estimate
(stamp says `computed`) if the request fails. Results are cached per location and date.

Click anywhere on the sky for a card with all six times and the day length; it fades after
three seconds. Times are shown in the viewer's own time zone.

The control panel and canvas shell come from the Toolcraft template (Pixel Point, MIT), which
also adds export/import of settings and aspect-ratio controls.

## Run it

```bash
git clone https://github.com/parthchandak02/sol.git
cd sol
npm install
npm run dev      # picks a free port, starting at 3002
npm run build    # type-check, then static site in dist/
```

The live version runs on Cloudflare Pages.

<details>
<summary><b>Project layout</b></summary>

```
src/components/SunPathCanvas.tsx  The piece: solar maths, API fetch, arc drawing
src/app/app-schema.ts             Sliders and city presets (Toolcraft schema)
src/routes/index.tsx              Preset handler and overlays: day length, stamp, legend, times card
src/toolcraft/                    Vendored Toolcraft runtime (do not edit)
brief.md                          The original creative brief
AGENTS.md, docs/toolcraft/        Toolcraft's rules for working in the repo
e2e/, scripts/                    Toolcraft's test and verification harness
```

</details>

<br>

<div align="center">
<sub>Built with React, Canvas 2D, Vite and the Toolcraft template. Data from sunrise-sunset.org.</sub>
</div>
