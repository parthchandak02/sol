// Draws one Sol frame in scene coordinates (0,0 = top-left of the product frame).
// The runtime paints the Background; everything here is transparent foreground.

import {
  computeSolDay,
  formatClock,
  formatCoordinates,
  formatDayOfYear,
  formatDuration,
  formatUtcOffset,
  solarPosition,
  utcOffsetMinutes,
  yearDayLengths,
  type SolDay,
} from "./solar";
import { SOL_YEAR, type SolSettings } from "./sol-settings";

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', 'Segoe UI', Arial, sans-serif";
const GOLD = "#D4892A";
const MIN_ELEVATION = -24;
const MAX_ELEVATION = 90;

export type SolScene = {
  day: SolDay;
  sunAzimuth: number;
  offsetMinutes: number;
  sunElevation: number;
  timeUtc: number;
  yearLengths: readonly number[];
};

/** Everything the drawing needs; computed once per settings change and reused by preview and export. */
export function computeSolScene(settings: SolSettings): SolScene {
  const day = computeSolDay(settings, SOL_YEAR, settings.dayOfYear);
  const timeUtc = day.midnightUtc + settings.time * 3_600_000;
  const position = solarPosition(settings.latitude, settings.longitude, timeUtc);
  return {
    sunAzimuth: position.azimuth,
    day,
    offsetMinutes: utcOffsetMinutes(settings, day.midnightUtc + 12 * 3_600_000),
    sunElevation: position.elevation,
    timeUtc,
    yearLengths: yearDayLengths(settings, SOL_YEAR),
  };
}

function luminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 1;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Dark ink on light backgrounds, warm white on dark ones. */
export function inkFor(settings: Pick<SolSettings, "background" | "includeBackground">): string {
  if (!settings.includeBackground) return "#1C2333";
  return luminance(settings.background) > 0.45 ? "#1C2333" : "#F2EDE4";
}

function withAlpha(hex: string, alpha: number): string {
  const v = hex.replace("#", "");
  return `rgba(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)}, ${alpha})`;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function compassPoint(azimuth: number): string {
  return COMPASS[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8];
}

function tracked(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
  let cursor = x;
  for (const char of text) {
    context.fillText(char, cursor, y);
    cursor += context.measureText(char).width + spacing;
  }
}

/** Chart rectangle in scene coordinates; shared by drawing and tests. */
export function solChartLayout(width: number, height: number) {
  const u = Math.min(width / 1920, height / 1080);
  const margin = 96 * u;
  return { chartBottom: height * 0.7, chartLeft: width * 0.4, chartRight: width - margin, chartTop: margin + 10 * u };
}

export function chartXAt(width: number, height: number, minute: number): number {
  const { chartLeft, chartRight } = solChartLayout(width, height);
  return chartLeft + (minute / 1440) * (chartRight - chartLeft);
}

export function chartYAt(width: number, height: number, elevation: number): number {
  const { chartBottom, chartTop } = solChartLayout(width, height);
  const clamped = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, elevation));
  return chartTop + ((MAX_ELEVATION - clamped) / (MAX_ELEVATION - MIN_ELEVATION)) * (chartBottom - chartTop);
}

/** Centre of the sun disc as a fraction of the frame (for export pixel checks). */
export function sunCentreRatio(settings: SolSettings, scene: SolScene, width = 1920, height = 1080): { xRatio: number; yRatio: number } {
  const minute = (scene.timeUtc - scene.day.midnightUtc) / 60_000;
  return { xRatio: chartXAt(width, height, minute) / width, yRatio: chartYAt(width, height, scene.sunElevation) / height };
}

export const SOL_GOLD = GOLD;

export function drawSol(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number, settings: SolSettings, scene: SolScene): void {
  const { day, offsetMinutes, sunAzimuth, sunElevation, timeUtc, yearLengths } = scene;
  const u = Math.min(width / 1920, height / 1080);
  const ink = inkFor(settings);
  const muted = withAlpha(ink, 0.55);
  const faint = withAlpha(ink, 0.14);
  const margin = 96 * u;
  context.save();
  context.textBaseline = "alphabetic";

  // ── Left column: place, date, day length, key times ──
  const left = margin;
  let y = margin + 24 * u;
  context.fillStyle = muted;
  context.font = `600 ${21 * u}px ${SANS}`;
  const heading = `${(settings.placeName ?? "Custom place").toUpperCase()}  ·  ${formatUtcOffset(offsetMinutes)}`;
  tracked(context, heading, left, y, 2.4 * u);
  y += 32 * u;
  context.font = `${20 * u}px ${SANS}`;
  context.fillText(formatCoordinates(settings.latitude, settings.longitude), left, y);

  y += 78 * u;
  context.fillStyle = ink;
  context.font = `${46 * u}px ${SERIF}`;
  context.fillText(formatDayOfYear(SOL_YEAR, settings.dayOfYear), left, y);

  y += 156 * u;
  context.font = `300 ${148 * u}px ${SERIF}`;
  context.fillText(formatDuration(day.dayLengthMinutes), left - 6 * u, y);
  y += 40 * u;
  context.fillStyle = muted;
  context.font = `${22 * u}px ${SANS}`;
  context.fillText(day.dayLengthMinutes >= 1439 ? "of daylight — the sun never sets" : day.dayLengthMinutes <= 1 ? "of daylight — the sun never rises" : "of daylight", left, y);

  const rows: [string, string][] = [
    ["Sunrise", formatClock(day.sunrise, offsetMinutes)],
    ["Sunset", formatClock(day.sunset, offsetMinutes)],
    ["Solar noon", `${formatClock(day.solarNoon, offsetMinutes)}   ${day.noonElevation.toFixed(1)}°`],
    ["Golden hour", day.goldenHourStart && day.goldenHourEnd ? `${formatClock(day.goldenHourStart, offsetMinutes)} – ${formatClock(day.goldenHourEnd, offsetMinutes)}` : "—"],
    ["Civil twilight", `${formatClock(day.civilDawn, offsetMinutes)} / ${formatClock(day.civilDusk, offsetMinutes)}`],
    [`Sun at ${formatClock(timeUtc, offsetMinutes)}`, `${sunElevation.toFixed(1)}°  ${compassPoint(sunAzimuth)}`],
  ];
  y += 74 * u;
  for (const [label, value] of rows) {
    context.strokeStyle = faint;
    context.lineWidth = Math.max(1, u);
    context.beginPath();
    context.moveTo(left, y - 38 * u);
    context.lineTo(left + 470 * u, y - 38 * u);
    context.stroke();
    context.fillStyle = muted;
    context.font = `${21 * u}px ${SANS}`;
    context.fillText(label, left, y);
    context.fillStyle = ink;
    context.font = `${30 * u}px ${SERIF}`;
    context.textAlign = "right";
    context.fillText(value, left + 470 * u, y);
    context.textAlign = "left";
    y += 64 * u;
  }

  // ── Chart: elevation over the local day ──
  const { chartBottom, chartLeft, chartRight, chartTop } = solChartLayout(width, height);
  const xAt = (minute: number) => chartXAt(width, height, minute);
  const yAt = (elevation: number) => chartYAt(width, height, elevation);
  const horizon = yAt(0);

  // Twilight bands under the horizon: civil, nautical, astronomical, night
  const bands: [number, number, number][] = [[0, -6, 0.05], [-6, -12, 0.09], [-12, -18, 0.13], [-18, MIN_ELEVATION, 0.17]];
  for (const [from, to, alpha] of bands) {
    context.fillStyle = withAlpha("#2B3A67", alpha * (ink === "#1C2333" ? 1 : 2));
    context.fillRect(chartLeft, yAt(from), chartRight - chartLeft, yAt(to) - yAt(from));
  }
  context.fillStyle = muted;
  context.font = `${18 * u}px ${SANS}`;
  context.textAlign = "right";
  for (const [label, elevation] of [["civil", -3], ["nautical", -9], ["astronomical", -15]] as const) {
    context.fillText(label, chartLeft - 14 * u, yAt(elevation) + 6 * u);
  }

  // Grid: altitude lines and three-hour ticks
  context.strokeStyle = faint;
  context.lineWidth = Math.max(1, u);
  for (const elevation of [30, 60, 90]) {
    context.beginPath();
    context.moveTo(chartLeft, yAt(elevation));
    context.lineTo(chartRight, yAt(elevation));
    context.stroke();
    context.textAlign = "right";
    context.fillText(`${elevation}°`, chartLeft - 14 * u, yAt(elevation) + 5 * u);
  }
  context.textAlign = "center";
  for (let hour = 0; hour <= 24; hour += 3) {
    const x = xAt(hour * 60);
    context.beginPath();
    context.moveTo(x, chartTop);
    context.lineTo(x, chartBottom);
    context.stroke();
    context.fillText(String(hour).padStart(2, "0"), x, chartBottom + 30 * u);
  }

  // Daylight area and curve
  const points = day.samples.map((elevation, i) => [xAt(i * 5), yAt(elevation)] as const);
  context.save();
  context.beginPath();
  context.rect(chartLeft, chartTop, chartRight - chartLeft, horizon - chartTop);
  context.clip();
  context.beginPath();
  context.moveTo(points[0][0], horizon);
  for (const [x, py] of points) context.lineTo(x, py);
  context.lineTo(points[points.length - 1][0], horizon);
  context.closePath();
  context.fillStyle = withAlpha(GOLD, 0.16);
  context.fill();
  context.beginPath();
  points.forEach(([x, py], i) => (i ? context.lineTo(x, py) : context.moveTo(x, py)));
  context.strokeStyle = GOLD;
  context.lineWidth = 4.5 * u;
  context.lineJoin = "round";
  context.stroke();
  context.restore();

  context.save();
  context.beginPath();
  context.rect(chartLeft, horizon, chartRight - chartLeft, chartBottom - horizon);
  context.clip();
  context.beginPath();
  points.forEach(([x, py], i) => (i ? context.lineTo(x, py) : context.moveTo(x, py)));
  context.setLineDash([8 * u, 8 * u]);
  context.strokeStyle = withAlpha(ink, 0.45);
  context.lineWidth = 2.5 * u;
  context.stroke();
  context.restore();

  // Horizon
  context.strokeStyle = withAlpha(ink, 0.6);
  context.lineWidth = 1.5 * u;
  context.beginPath();
  context.moveTo(chartLeft, horizon);
  context.lineTo(chartRight, horizon);
  context.stroke();

  // Sun at the chosen time
  const timeMinute = (timeUtc - day.midnightUtc) / 60_000;
  const sunX = xAt(timeMinute);
  const sunY = yAt(sunElevation);
  context.strokeStyle = withAlpha(ink, 0.35);
  context.lineWidth = Math.max(1, u);
  context.beginPath();
  context.moveTo(sunX, sunY);
  context.lineTo(sunX, chartBottom);
  context.stroke();
  if (sunElevation > -0.833) {
    // Soft glow as concentric translucent rings
    for (const [radius, alpha] of [[90, 0.06], [70, 0.08], [52, 0.12], [38, 0.18]] as const) {
      context.fillStyle = withAlpha(GOLD, alpha);
      context.beginPath();
      context.arc(sunX, sunY, radius * u, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = GOLD;
    context.beginPath();
    context.arc(sunX, sunY, 22 * u, 0, Math.PI * 2);
    context.fill();
  } else {
    context.strokeStyle = withAlpha(ink, 0.7);
    context.lineWidth = 3 * u;
    context.beginPath();
    context.arc(sunX, sunY, 18 * u, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = ink;
  context.font = `${30 * u}px ${SERIF}`;
  const nearRight = sunX > chartRight - 220 * u;
  context.textAlign = nearRight ? "right" : "left";
  const labelX = sunX + (nearRight ? -36 : 36) * u;
  // Keep the label clear of the horizon line when the sun is close to or below it
  const labelY = Math.max(chartTop + 30 * u, Math.min(sunY - 30 * u, horizon - 44 * u));
  context.fillText(formatClock(timeUtc, offsetMinutes), labelX, labelY);
  context.fillStyle = muted;
  context.font = `${20 * u}px ${SANS}`;
  context.fillText(`${sunElevation.toFixed(1)}° ${sunElevation > -0.833 ? "above" : "below"} the horizon`, labelX, labelY + 26 * u);

  // ── Year strip: day length through the year ──
  const stripTop = height * 0.79;
  const stripBottom = height - margin + 6 * u;
  const yLen = (minutes: number) => stripBottom - (minutes / 1440) * (stripBottom - stripTop);
  const xDay = (dayOfYear: number) => chartLeft + ((dayOfYear - 1) / 364) * (chartRight - chartLeft);
  context.beginPath();
  context.moveTo(xDay(1), stripBottom);
  yearLengths.forEach((minutes, i) => context.lineTo(xDay(i + 1), yLen(minutes)));
  context.lineTo(xDay(365), stripBottom);
  context.closePath();
  context.fillStyle = withAlpha(ink, 0.08);
  context.fill();
  context.beginPath();
  yearLengths.forEach((minutes, i) => (i ? context.lineTo(xDay(i + 1), yLen(minutes)) : context.moveTo(xDay(1), yLen(minutes))));
  context.strokeStyle = withAlpha(ink, 0.55);
  context.lineWidth = 2 * u;
  context.stroke();
  context.strokeStyle = faint;
  context.lineWidth = Math.max(1, u);
  context.beginPath();
  context.moveTo(chartLeft, yLen(720));
  context.lineTo(chartRight, yLen(720));
  context.stroke();
  context.fillStyle = muted;
  context.font = `${18 * u}px ${SANS}`;
  context.textAlign = "right";
  context.fillText("12h", chartLeft - 14 * u, yLen(720) + 5 * u);
  context.textAlign = "center";
  "JFMAMJJASOND".split("").forEach((initial, month) => {
    const dayOfYear = Math.round((Date.UTC(SOL_YEAR, month, 15) - Date.UTC(SOL_YEAR, 0, 0)) / 86_400_000);
    context.fillText(initial, xDay(dayOfYear), stripBottom + 28 * u);
  });
  const markerX = xDay(settings.dayOfYear);
  const markerY = yLen(yearLengths[Math.round(settings.dayOfYear) - 1] ?? 0);
  context.strokeStyle = GOLD;
  context.lineWidth = 2 * u;
  context.beginPath();
  context.moveTo(markerX, stripTop - 6 * u);
  context.lineTo(markerX, stripBottom);
  context.stroke();
  context.fillStyle = GOLD;
  context.beginPath();
  context.arc(markerX, markerY, 7 * u, 0, Math.PI * 2);
  context.fill();

  // Credit
  context.textAlign = "left";
  context.fillStyle = withAlpha(ink, 0.4);
  context.font = `${16 * u}px ${SANS}`;
  context.fillText("Sun position after the NOAA solar calculator", left, height - margin + 34 * u);
  context.restore();
}
