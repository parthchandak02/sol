# sol — Sun Path Explorer

Interactive sun path visualization. Drag sliders to explore how the sun's daily arc changes by latitude and season.

**Visual Style:** Light - Breeze (pastel sky, pale blue background, golden sun, lavender twilight)

**Data Source:** Sunrise-Sunset API (api.sunrise-sunset.org)

**How it works:**
- Latitude and longitude sliders control your location on Earth
- Day-of-year slider changes the season
- A golden sun animates along a curved arc from sunrise to sunset
- Daytime portion of the arc is highlighted in bright blue, twilight zones in lavender
- The arc gets wider (longer day) in summer and narrower (shorter day) in winter
- Hero number shows total day length in hours and minutes
- Tap anywhere to reveal exact sunrise, sunset, solar noon, and twilight times

**GitHub:** https://github.com/parthchandak02/sol

**Live:** https://sol.parthchandak.info

**Tech:** Pixel Point Toolcraft + Vite. Canvas 2D sun path rendering. Hosted on Cloudflare Pages.
