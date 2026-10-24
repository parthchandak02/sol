import * as React from "react";
import { useToolcraft, useToolcraftValue } from "@/toolcraft/runtime/react";

// ─── Breeze Palette ───
const PALETTE = {
  bg: "#e8f4f8",
  depth: "#d4ecf0",
  sunColor: "#ffd54f",
  sunGlow: "#ffecb3",
  arcColor: "rgba(129,212,250,0.3)",
  arcHighlight: "#4fc3f7",
  twilightColor: "rgba(206,147,216,0.3)",
  text: "rgba(0,0,0,0.5)",
  textBold: "rgba(0,0,0,0.7)",
  horizon: "rgba(0,0,0,0.08)",
  timeLabel: "rgba(0,0,0,0.35)",
};

// ─── Solar position computation ───
function declination(day: number): number {
  return 23.44 * Math.sin(((2 * Math.PI) / 365) * (284 + day));
}

function solarNoonAltitude(lat: number, day: number): number {
  const dec = declination(day);
  return 90 - Math.abs(lat - dec);
}

function dayLengthHours(lat: number, day: number): number {
  const dec = (declination(day) * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const cosHA = -Math.tan(latRad) * Math.tan(dec);
  if (cosHA > 1) return 0; // polar night
  if (cosHA < -1) return 24; // midnight sun
  const ha = Math.acos(cosHA);
  return (2 * ha * 180) / Math.PI / 15; // hours (15 degrees of hour angle per hour)
}

// ─── Sun position on arc ───
interface SunArcParams {
  lat: number;
  lng: number;
  day: number;
  solarNoonAltitude: number;
  dayLength: number;
}

// ─── API response ───
interface SunriseSunsetResult {
  sunrise: string;
  sunset: string;
  solar_noon: string;
  day_length: number;
  civil_twilight_begin: string;
  civil_twilight_end: string;
  isFallback: boolean;
}

const CACHE: Record<string, SunriseSunsetResult> = {};

async function fetchSunData(lat: number, lng: number, day: number): Promise<SunriseSunsetResult> {
  const now = new Date();
  const date = new Date(now.getFullYear(), 0, day);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const cacheKey = `${lat.toFixed(1)}_${lng.toFixed(1)}_${dateStr}`;
  if (CACHE[cacheKey]) return CACHE[cacheKey];

  try {
    const res = await fetch(
      `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${dateStr}&formatted=0`
    );
    const json = await res.json();
    if (json.status !== "OK") throw new Error("API error");
    const result: SunriseSunsetResult = {
      sunrise: json.results.sunrise,
      sunset: json.results.sunset,
      solar_noon: json.results.solar_noon,
      day_length: json.results.day_length,
      civil_twilight_begin: json.results.civil_twilight_begin,
      civil_twilight_end: json.results.civil_twilight_end,
      isFallback: false,
    };
    CACHE[cacheKey] = result;
    return result;
  } catch {
    // Fallback: compute approximate values
    const alt = solarNoonAltitude(lat, day);
    const dl = dayLengthHours(lat, day);
    const noon = new Date(date);
    noon.setHours(12, 0, 0, 0);
    const halfDay = (dl * 3600) / 2;
    const sunriseDate = new Date(noon.getTime() - halfDay * 1000);
    const sunsetDate = new Date(noon.getTime() + halfDay * 1000);
    const twiBegin = new Date(sunriseDate.getTime() - 30 * 60 * 1000);
    const twiEnd = new Date(sunsetDate.getTime() + 30 * 60 * 1000);

    const result: SunriseSunsetResult = {
      sunrise: sunriseDate.toISOString(),
      sunset: sunsetDate.toISOString(),
      solar_noon: noon.toISOString(),
      day_length: dl * 3600,
      civil_twilight_begin: twiBegin.toISOString(),
      civil_twilight_end: twiEnd.toISOString(),
      isFallback: true,
    };
    CACHE[cacheKey] = result;
    return result;
  }
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDayLength(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─── Draw Arc ───
function drawSunArc(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  params: SunArcParams,
  sunData: SunriseSunsetResult | null,
  animProgress: number
): { sunX: number; sunY: number; sunProgress: number } {
  const { lat, solarNoonAltitude, dayLength } = params;

  // Arc geometry
  const centerY = H * 0.7;
  const maxArcHeight = Math.min(H * 0.4, solarNoonAltitude / 90 * H * 0.4);
  const arcWidth = W * 0.75;
  const leftX = (W - arcWidth) / 2;
  const rightX = leftX + arcWidth;

  // The arc is a quadratic bezier from left to right, peaking at center
  // Sun's altitude determines arc height
  // Day length determines how much of the arc is above horizon (daytime portion)

  // Compute the daytime sweep angle
  const dayRatio = Math.min(Math.max(dayLength / 86400, 0), 1);
  const totalSweep = Math.PI; // 180 degrees for full arc
  const daySweep = totalSweep * dayRatio;
  const nightSweep = totalSweep - daySweep;

  // The arc curve: quadratic bezier from (leftX, centerY) through (W/2, centerY - maxArcHeight) to (rightX, centerY)
  const cpX = W / 2;
  const cpY = centerY - maxArcHeight * 2;

  // Draw the full arc path (faint)
  ctx.beginPath();
  ctx.moveTo(leftX, centerY);
  ctx.quadraticCurveTo(cpX, cpY, rightX, centerY);
  ctx.strokeStyle = PALETTE.arcColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw daytime portion (brighter)
  // Day portion ratio of total arc
  const dayPortionT = dayRatio;
  const dayEndT = (1 - dayRatio) / 2 + dayRatio; // center it
  const dayStartT = (1 - dayRatio) / 2;

  // We need to draw the quadratic bezier from t=dayStartT to t=dayEndT
  // Use de Casteljau to sample points along the curve
  function sampleQuadBezier(
    p0x: number,
    p0y: number,
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    t: number
  ): [number, number] {
    const mt = 1 - t;
    const x = mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x;
    const y = mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y;
    return [x, y];
  }

  // Draw daytime arc segment
  const segments = 30;
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = dayStartT + (i / segments) * dayPortionT;
    const [x, y] = sampleQuadBezier(leftX, centerY, cpX, cpY, rightX, centerY, t);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = PALETTE.arcHighlight;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Draw twilight zones (glow near sunrise/sunset)
  const twiWidth = 0.06;
  for (const side of ["left", "right"] as const) {
    const twiStart = side === "left" ? Math.max(0, dayStartT - twiWidth) : Math.min(1, dayEndT);
    const twiEnd = side === "left" ? dayStartT : Math.min(1, dayEndT + twiWidth);
    ctx.beginPath();
    const nSegs = 20;
    for (let i = 0; i <= nSegs; i++) {
      const t = twiStart + (i / nSegs) * (twiEnd - twiStart);
      const [x, y] = sampleQuadBezier(leftX, centerY, cpX, cpY, rightX, centerY, t);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = PALETTE.twilightColor;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // Draw sun at current position along daytime arc
  // AnimProgress: 0 = sunrise, 1 = sunset
  const sunT = dayStartT + animProgress * dayPortionT;
  const [sunX, sunY] = sampleQuadBezier(leftX, centerY, cpX, cpY, rightX, centerY, sunT);

  // Sun glow
  const glowRadius = 40 + Math.sin(Date.now() * 0.002) * 10;
  const grad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowRadius);
  grad.addColorStop(0, "rgba(255,213,79,0.8)");
  grad.addColorStop(0.3, "rgba(255,236,179,0.4)");
  grad.addColorStop(1, "rgba(255,236,179,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Sun core
  const sunRadius = 18 + Math.sin(Date.now() * 0.003) * 2;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.sunColor;
  ctx.fill();

  // Sun bright center
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunRadius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fill();

  return { sunX, sunY, sunProgress: sunT };
}

// ─── Draw Horizon ───
function drawHorizon(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const y = H * 0.7;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.strokeStyle = PALETTE.horizon;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Subtle horizon glow
  const grad = ctx.createLinearGradient(0, y - 40, 0, y + 2);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(255,255,255,0.1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, y - 40, W, 42);
}

// ─── Draw Time Labels ───
function drawTimeLabels(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  sunData: SunriseSunsetResult | null,
  dayStartT: number,
  dayEndT: number
) {
  if (!sunData) return;
  const centerY = H * 0.7;
  const arcWidth = W * 0.75;
  const leftX = (W - arcWidth) / 2;
  const cpX = W / 2;

  function labelPos(t: number): [number, number] {
    const mt = 1 - t;
    const x = mt * mt * leftX + 2 * mt * t * cpX + t * t * (leftX + arcWidth);
    const y = mt * mt * centerY + 2 * mt * t * (centerY - 40) + t * t * centerY;
    return [x, y];
  }

  ctx.font = "10px system-ui, sans-serif";
  ctx.fillStyle = PALETTE.timeLabel;
  ctx.textAlign = "center";

  const labels: { t: number; text: string }[] = [];

  // Sunrise label at dayStartT position
  labels.push({ t: dayStartT, text: formatTime(sunData.sunrise) });

  // Solar noon at center (t=0.5)
  labels.push({ t: 0.5, text: formatTime(sunData.solar_noon) });

  // Sunset at dayEndT
  labels.push({ t: dayEndT, text: formatTime(sunData.sunset) });

  // Night time labels at edges
  labels.push({ t: 0, text: formatTime(sunData.civil_twilight_begin) });
  labels.push({ t: 1, text: formatTime(sunData.civil_twilight_end) });

  labels.forEach(({ t, text }) => {
    if (t < 0 || t > 1) return;
    const [x, y] = labelPos(t);
    const labelY = y + 18;
    ctx.fillText(text, x, labelY + 4);
  });

  // Draw horizon label
  ctx.font = "9px system-ui, sans-serif";
  ctx.fillStyle = PALETTE.timeLabel;
  ctx.textAlign = "center";
  ctx.fillText("horizon", W / 2, centerY + 30);
}

// ─── Main Component ───
export function SunPathCanvas({
  quietZoneRef,
  sunDataRef,
  onDataUpdate,
}: {
  quietZoneRef?: React.MutableRefObject<
    ((data: SunriseSunsetResult) => void) | null
  >;
  sunDataRef?: React.MutableRefObject<SunriseSunsetResult | null>;
  onDataUpdate?: (data: SunriseSunsetResult) => void;
}): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animRef = React.useRef(0);
  const internalSunDataRef = React.useRef<SunriseSunsetResult | null>(null);
  const lastFetchRef = React.useRef(0);
  const animProgressRef = React.useRef(0.5); // start at noon

  const latitude = (useToolcraftValue("latitude") as number) ?? 40.7;
  const longitude = (useToolcraftValue("longitude") as number) ?? -74.0;
  const dayOfYear = (useToolcraftValue("dayOfYear") as number) ?? 172;

  const fetchRef = React.useRef<(() => void) | null>(null);

  // Fit the whole output frame inside the visible viewport so the arc and its
  // labels are never cut off at the window edges
  const { dispatch, state } = useToolcraft();
  const frameWidth = state.canvas.size.width;
  const frameHeight = state.canvas.size.height;
  React.useEffect(() => {
    function fit() {
      const viewport = canvasRef.current?.closest<HTMLElement>("[data-slot='toolcraft-runtime-canvas']");
      if (!viewport || !frameWidth || !frameHeight) return;
      const zoom = Math.min(viewport.clientWidth / frameWidth, viewport.clientHeight / frameHeight) * 100;
      dispatch({ type: "canvas.setViewport", offset: { x: 0, y: 0 }, zoom: Math.floor(zoom) });
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [dispatch, frameWidth, frameHeight]);

  // Fetch sun data
  const doFetch = React.useCallback(async () => {
    const data = await fetchSunData(latitude, longitude, dayOfYear);
    internalSunDataRef.current = data;
    if (sunDataRef) sunDataRef.current = data;
    if (onDataUpdate) onDataUpdate(data);
    lastFetchRef.current = Date.now();
  }, [latitude, longitude, dayOfYear, sunDataRef, onDataUpdate]);

  React.useEffect(() => {
    doFetch();
    fetchRef.current = doFetch;
  }, [doFetch]);

  // Update quiet zone
  React.useEffect(() => {
    if (quietZoneRef) {
      quietZoneRef.current = (data: SunriseSunsetResult) => {
        // handled by route
      };
    }
    return () => {
      if (quietZoneRef) quietZoneRef.current = null;
    };
  }, [quietZoneRef]);

  // Render loop
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let dpr = 1;

    // Size the drawing buffer to the output frame the canvas sits in, not the window
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const frame = canvas!.parentElement ?? canvas!;
      W = frame.clientWidth || window.innerWidth;
      H = frame.clientHeight || window.innerHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement ?? canvas);

    function draw() {
      // Background
      const grad = ctx!.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, Math.max(W, H) * 0.7);
      grad.addColorStop(0, "#f0f8ff");
      grad.addColorStop(0.5, PALETTE.bg);
      grad.addColorStop(1, PALETTE.depth);
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, W, H);

      // Horizon
      drawHorizon(ctx!, W, H);

      // Compute sun params
      const alt = solarNoonAltitude(latitude, dayOfYear);
      const dl = dayLengthHours(latitude, dayOfYear);

      const sunParams: SunArcParams = {
        lat: latitude,
        lng: longitude,
        day: dayOfYear,
        solarNoonAltitude: alt,
        dayLength: dl * 3600,
      };

      // Animate sun progress (move from sunrise to sunset during daytime)
      const sunData = internalSunDataRef.current;
      if (sunData) {
        // Place the sun by the current time of day on the selected date, so the
        // sun moves on any day, not only when the selected day is today
        const DAY_MS = 86400000;
        const sunrise = new Date(sunData.sunrise).getTime();
        const sunset = new Date(sunData.sunset).getTime();
        const total = sunset - sunrise;
        if (total > 0) {
          const sinceSunrise = (((Date.now() - sunrise) % DAY_MS) + DAY_MS) % DAY_MS;
          if (sinceSunrise <= total) {
            animProgressRef.current = sinceSunrise / total;
          } else {
            // Night: park at sunset until midway through the night, then at sunrise
            animProgressRef.current = sinceSunrise - total < (DAY_MS - total) / 2 ? 1 : 0;
          }
        }
      } else {
        // Approximate: midday sun
        animProgressRef.current = 0.5;
      }

      const { sunX, sunY } = drawSunArc(ctx!, W, H, sunParams, sunData, animProgressRef.current);

      // Time labels
      const dayRatio = Math.min(Math.max(dl / 24, 0), 1);
      const dayStartT = (1 - dayRatio) / 2;
      const dayEndT = dayStartT + dayRatio;
      drawTimeLabels(ctx!, W, H, sunData, dayStartT, dayEndT);

      // Update stamp timestamp
      lastFetchRef.current = Date.now();

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
    };
  }, [latitude, longitude, dayOfYear]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const data = internalSunDataRef.current;
    if (!data) return;
    if (quietZoneRef?.current) {
      quietZoneRef.current(data);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: "manipulation", cursor: "crosshair" }}
      onClick={handleCanvasClick}
    />
  );
}
