// Canvas 2D drawing for Sol. One function draws the whole piece (sky, arc, sun, labels,
// day length, legend, data stamp) in output CSS pixels, so preview and PNG export match.

import {
  dayLengthHours,
  formatClockTime,
  formatDayLength,
  solarNoonAltitude,
  sunProgress,
  type SunTimes,
} from "./sun-model";

export const SUN_PATH_COLORS = {
  arc: "rgba(79,195,247,0.28)",
  daytime: "#4fc3f7",
  horizon: "rgba(0,0,0,0.08)",
  sun: "#ffd54f",
  text: "rgba(0,0,0,0.8)",
  textMuted: "rgba(0,0,0,0.45)",
  textSoft: "rgba(0,0,0,0.35)",
  twilight: "rgba(206,147,216,0.55)",
  twilightText: "#ce93d8",
} as const;

export type SunPathScene = {
  background: string;
  dayOfYear: number;
  height: number;
  includeBackground: boolean;
  latitude: number;
  nowMs: number;
  /** Times from the API (or the computed estimate); null before the first answer arrives. */
  times: SunTimes | null;
  width: number;
};

export type SunArcGeometry = {
  controlX: number;
  controlY: number;
  dayEndT: number;
  dayStartT: number;
  horizonY: number;
  leftX: number;
  rightX: number;
};

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const TWILIGHT_SPAN = 0.06;

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? match[1].replace(/./g, (c) => c + c) : match[1];
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

/** Mix a hex colour toward white (amount > 0) or black (amount < 0); returns rgb(). */
export function shadeColor(hex: string, amount: number): string {
  const rgb = parseHex(hex) ?? [232, 244, 248];
  const target = amount >= 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  const [r, g, b] = rgb.map((c) => Math.round(c + (target - c) * t));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Share of the 24-hour day that is daylight, from the sunrise equation (0..1). */
export function daylightRatio(latitude: number, dayOfYear: number): number {
  return Math.min(1, Math.max(0, dayLengthHours(latitude, dayOfYear) / 24));
}

export function sunArcGeometry(scene: Pick<SunPathScene, "dayOfYear" | "height" | "latitude" | "width">): SunArcGeometry {
  const { dayOfYear, height, latitude, width } = scene;
  const horizonY = height * 0.7;
  const altitude = Math.max(0, solarNoonAltitude(latitude, dayOfYear));
  const arcHeight = Math.min(height * 0.4, (altitude / 90) * height * 0.4);
  const arcWidth = width * 0.75;
  const leftX = (width - arcWidth) / 2;
  const ratio = daylightRatio(latitude, dayOfYear);
  const dayStartT = (1 - ratio) / 2;

  return {
    controlX: width / 2,
    controlY: horizonY - arcHeight * 2,
    dayEndT: dayStartT + ratio,
    dayStartT,
    horizonY,
    leftX,
    rightX: leftX + arcWidth,
  };
}

export function pointOnArc(geometry: SunArcGeometry, t: number): [number, number] {
  const { controlX, controlY, horizonY, leftX, rightX } = geometry;
  const mt = 1 - t;
  return [
    mt * mt * leftX + 2 * mt * t * controlX + t * t * rightX,
    mt * mt * horizonY + 2 * mt * t * controlY + t * t * horizonY,
  ];
}

function strokeArcSegment(
  context: CanvasRenderingContext2D,
  geometry: SunArcGeometry,
  from: number,
  to: number,
  style: string,
  lineWidth: number,
): void {
  if (to <= from) return;
  const segments = Math.max(8, Math.ceil((to - from) * 120));
  context.beginPath();
  for (let i = 0; i <= segments; i += 1) {
    const [x, y] = pointOnArc(geometry, from + ((to - from) * i) / segments);
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = style;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.stroke();
}

type ArcLabel = { name: string; priority: number; t: number; time: string };

function arcLabels(times: SunTimes, geometry: SunArcGeometry): ArcLabel[] {
  const polar = times.dayLengthSeconds <= 0 || times.dayLengthSeconds >= 86_399;
  if (polar) {
    return [
      {
        name: times.dayLengthSeconds <= 0 ? "polar night" : "midnight sun",
        priority: 0,
        t: 0.5,
        time: formatClockTime(times.solarNoon),
      },
    ];
  }

  return [
    { name: "solar noon", priority: 0, t: 0.5, time: formatClockTime(times.solarNoon) },
    { name: "sunrise", priority: 1, t: geometry.dayStartT, time: formatClockTime(times.sunrise) },
    { name: "sunset", priority: 1, t: geometry.dayEndT, time: formatClockTime(times.sunset) },
    { name: "first light", priority: 2, t: 0, time: formatClockTime(times.civilTwilightBegin) },
    { name: "last light", priority: 2, t: 1, time: formatClockTime(times.civilTwilightEnd) },
  ];
}

function drawArcLabels(
  context: CanvasRenderingContext2D,
  geometry: SunArcGeometry,
  times: SunTimes,
  unit: number,
): void {
  const timeSize = 26 * unit;
  const nameSize = 19 * unit;
  const placed: { left: number; right: number }[] = [];
  const labels = arcLabels(times, geometry).sort((a, b) => a.priority - b.priority);

  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  for (const label of labels) {
    const x = pointOnArc(geometry, label.t)[0];
    context.font = `500 ${timeSize}px ${FONT}`;
    const halfWidth = Math.max(context.measureText(label.time).width, context.measureText(label.name).width) / 2 + 10 * unit;
    if (placed.some((box) => x + halfWidth > box.left && x - halfWidth < box.right)) continue;
    placed.push({ left: x - halfWidth, right: x + halfWidth });

    const top = geometry.horizonY + 44 * unit;
    context.fillStyle = SUN_PATH_COLORS.textMuted;
    context.fillText(label.time, x, top);
    context.font = `${nameSize}px ${FONT}`;
    context.fillStyle = SUN_PATH_COLORS.textSoft;
    context.fillText(label.name, x, top + 28 * unit);
  }
}

function drawLegend(context: CanvasRenderingContext2D, width: number, height: number, unit: number): void {
  const parts: { color: string; text: string }[] = [
    { color: SUN_PATH_COLORS.daytime, text: "daytime" },
    { color: SUN_PATH_COLORS.textSoft, text: "  |  " },
    { color: SUN_PATH_COLORS.twilightText, text: "twilight" },
    { color: SUN_PATH_COLORS.textSoft, text: "  |  " },
    { color: "#e0b000", text: "sun" },
    { color: SUN_PATH_COLORS.textSoft, text: "  |  wider arc = longer day" },
  ];
  context.font = `${21 * unit}px ${FONT}`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const total = parts.reduce((sum, part) => sum + context.measureText(part.text).width, 0);
  let x = (width - total) / 2;
  const y = height - 66 * unit;
  for (const part of parts) {
    context.fillStyle = part.color;
    context.fillText(part.text, x, y);
    x += context.measureText(part.text).width;
  }
}

/** Draw the whole Sol piece into a context whose transform maps 1 unit to 1 output CSS pixel. */
export function drawSunPath(context: CanvasRenderingContext2D, scene: SunPathScene): void {
  const { background, height, includeBackground, nowMs, times, width } = scene;
  const unit = Math.sqrt((width * height) / (1920 * 1080));

  context.clearRect(0, 0, width, height);

  if (includeBackground) {
    const sky = context.createRadialGradient(width / 2, height * 0.3, 0, width / 2, height * 0.3, Math.max(width, height) * 0.7);
    sky.addColorStop(0, shadeColor(background, 0.45));
    sky.addColorStop(0.5, shadeColor(background, 0));
    sky.addColorStop(1, shadeColor(background, -0.07));
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);
  }

  const geometry = sunArcGeometry(scene);

  // Horizon line with a soft glow above it
  context.beginPath();
  context.moveTo(0, geometry.horizonY);
  context.lineTo(width, geometry.horizonY);
  context.strokeStyle = SUN_PATH_COLORS.horizon;
  context.lineWidth = Math.max(1, unit);
  context.stroke();

  // Full arc, then twilight bands, then the daytime segment on top
  strokeArcSegment(context, geometry, 0, 1, SUN_PATH_COLORS.arc, 2 * unit);
  strokeArcSegment(context, geometry, Math.max(0, geometry.dayStartT - TWILIGHT_SPAN), geometry.dayStartT, SUN_PATH_COLORS.twilight, 8 * unit);
  strokeArcSegment(context, geometry, geometry.dayEndT, Math.min(1, geometry.dayEndT + TWILIGHT_SPAN), SUN_PATH_COLORS.twilight, 8 * unit);
  strokeArcSegment(context, geometry, geometry.dayStartT, geometry.dayEndT, SUN_PATH_COLORS.daytime, 5 * unit);

  // Sun at the current time of day
  const progress = sunProgress(times, nowMs);
  const [sunX, sunY] = pointOnArc(geometry, geometry.dayStartT + progress * (geometry.dayEndT - geometry.dayStartT));
  const glowRadius = 80 * unit;
  const glow = context.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowRadius);
  glow.addColorStop(0, "rgba(255,213,79,0.8)");
  glow.addColorStop(0.3, "rgba(255,236,179,0.4)");
  glow.addColorStop(1, "rgba(255,236,179,0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(sunX, sunY, glowRadius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = SUN_PATH_COLORS.sun;
  context.beginPath();
  context.arc(sunX, sunY, 34 * unit, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.6)";
  context.beginPath();
  context.arc(sunX, sunY, 14 * unit, 0, Math.PI * 2);
  context.fill();

  if (times) drawArcLabels(context, geometry, times, unit);

  // Day length, top left
  const dayLengthSeconds = times ? times.dayLengthSeconds : dayLengthHours(scene.latitude, scene.dayOfYear) * 3600;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = SUN_PATH_COLORS.text;
  context.font = `300 ${104 * unit}px ${FONT}`;
  context.fillText(formatDayLength(dayLengthSeconds), 56 * unit, 52 * unit);
  context.fillStyle = SUN_PATH_COLORS.textMuted;
  context.font = `${22 * unit}px ${FONT}`;
  context.fillText("DAY LENGTH", 60 * unit, 52 * unit + 118 * unit);

  drawLegend(context, width, height, unit);

  // Data stamp, bottom left
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = SUN_PATH_COLORS.textMuted;
  context.font = `${19 * unit}px ${FONT}`;
  const stamp = times
    ? `Data: sunrise-sunset.org · ${times.source === "live" ? "live" : "computed estimate"}`
    : "Data: sunrise-sunset.org · loading";
  context.fillText(stamp, 40 * unit, height - 34 * unit);
}
