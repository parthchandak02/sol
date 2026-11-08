import { describe, expect, it, vi } from "vitest";

import { createToolcraftState, type ToolcraftState } from "@/toolcraft/runtime";

import { handlePanelAction } from "../app/app-composition";
import { appPerformance } from "../app/app-performance";
import { appSchema } from "../app/app-schema";
import { exportMimeType, renderSunPathExportCanvas } from "./sun-export";
import { EXPORT_PNG_ACTION } from "./sun-export-actions";
import {
  computeSunTimes,
  dayLengthHours,
  formatClockTime,
  formatDayLength,
  loadSunTimes,
  clearSunTimesCache,
  parseSunriseSunsetResponse,
  sunProgress,
  type SunTimes,
} from "./sun-model";
import { drawSunPath, shadeColor, sunArcGeometry, type SunPathScene } from "./sun-path-draw";
import { CITY_PRESETS, SOL_DEFAULTS, SOL_TARGETS, readSunPathSettings } from "./sun-path-settings";

// ─── Recording 2D context ───

type Op = { args: unknown[]; fillStyle?: unknown; name: string; strokeStyle?: unknown };

class FakeGradient {
  stops: [number, string][] = [];
  addColorStop(offset: number, color: string): void {
    this.stops.push([offset, color]);
  }
}

class FakeContext {
  fillStyle: unknown = "#000";
  font = "10px sans-serif";
  lineCap = "butt";
  lineWidth = 1;
  ops: Op[] = [];
  strokeStyle: unknown = "#000";
  textAlign = "start";
  textBaseline = "alphabetic";
  gradients: FakeGradient[] = [];

  private record(name: string, args: unknown[]): void {
    this.ops.push({ args, fillStyle: this.fillStyle, name, strokeStyle: this.strokeStyle });
  }
  arc(...args: unknown[]) { this.record("arc", args); }
  beginPath() { this.record("beginPath", []); }
  clearRect(...args: unknown[]) { this.record("clearRect", args); }
  createRadialGradient() { const g = new FakeGradient(); this.gradients.push(g); return g; }
  fill() { this.record("fill", []); }
  fillRect(...args: unknown[]) { this.record("fillRect", args); }
  fillText(...args: unknown[]) { this.record("fillText", args); }
  lineTo(...args: unknown[]) { this.record("lineTo", args); }
  measureText(text: string) { return { width: text.length * (parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)?.[1] ?? "10") * 0.55) }; }
  moveTo(...args: unknown[]) { this.record("moveTo", args); }
  restore() { this.record("restore", []); }
  save() { this.record("save", []); }
  scale(...args: unknown[]) { this.record("scale", args); }
  setTransform(...args: unknown[]) { this.record("setTransform", args); }
  stroke() { this.record("stroke", []); }

  texts(): string[] {
    return this.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]));
  }
}

class FakeCanvas {
  height = 0;
  width = 0;
  readonly context = new FakeContext();
  getContext() {
    return this.context;
  }
}

function draw(scene: Partial<SunPathScene> = {}): FakeContext {
  const context = new FakeContext();
  drawSunPath(context as unknown as CanvasRenderingContext2D, {
    background: SOL_DEFAULTS.background,
    dayOfYear: 172,
    height: 1080,
    includeBackground: true,
    latitude: 40.7,
    nowMs: Date.UTC(2026, 5, 21, 17, 0),
    times: TIMES,
    width: 1920,
    ...scene,
  });
  return context;
}

const TIMES: SunTimes = {
  civilTwilightBegin: "2026-06-21T08:55:00.000Z",
  civilTwilightEnd: "2026-06-22T01:03:00.000Z",
  dayLengthSeconds: 15 * 3600 + 5 * 60,
  solarNoon: "2026-06-21T16:58:00.000Z",
  source: "live",
  sunrise: "2026-06-21T09:25:00.000Z",
  sunset: "2026-06-22T00:31:00.000Z",
};

function stateWith(values: Record<string, unknown> = {}): ToolcraftState {
  const state = createToolcraftState(appSchema);
  return { ...state, values: { ...state.values, ...values } };
}

function exportCanvas(values: Record<string, unknown> = {}): FakeCanvas {
  const canvas = new FakeCanvas();
  renderSunPathExportCanvas(stateWith(values), TIMES, Date.UTC(2026, 5, 21, 17, 0), () => canvas as unknown as HTMLCanvasElement);
  return canvas;
}

function fullCanvasFills(context: FakeContext, width: number, height: number): Op[] {
  return context.ops.filter(
    (op) => op.name === "fillRect" && op.args[2] === width && op.args[3] === height,
  );
}

function drawOpCount(scene: Partial<SunPathScene> = {}): number {
  return draw(scene).ops.length;
}

// A redraw that stays well below a few thousand canvas calls is a cheap frame for Canvas 2D
const CHEAP_REDRAW_OPS = 2000;

// ─── Acceptance ───

describe("Sol acceptance", () => {
  it("latitude reshapes the arc height and daytime share", () => {
    const newYork = sunArcGeometry({ dayOfYear: 172, height: 1080, latitude: 40.7, width: 1920 });
    const arctic = sunArcGeometry({ dayOfYear: 172, height: 1080, latitude: 80, width: 1920 });
    // Further north the noon sun is lower, so the arc's peak sits lower (larger y)
    expect(arctic.controlY).toBeGreaterThan(newYork.controlY);
    // and in June the lit share of the arc grows toward the midnight sun
    expect(arctic.dayEndT - arctic.dayStartT).toBeGreaterThan(newYork.dayEndT - newYork.dayStartT);
    expect(draw({ latitude: 80, times: null }).texts()).toContain(formatDayLength(dayLengthHours(80, 172) * 3600));
  });

  it("longitude changes the place used for API clock times", async () => {
    clearSunTimesCache();
    const urls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      urls.push(url);
      const east = url.includes("lng=139.7");
      return {
        json: async () => ({
          results: {
            civil_twilight_begin: east ? "2026-06-20T18:55:00+00:00" : TIMES.civilTwilightBegin,
            civil_twilight_end: east ? "2026-06-21T10:30:00+00:00" : TIMES.civilTwilightEnd,
            day_length: TIMES.dayLengthSeconds,
            solar_noon: east ? "2026-06-21T02:42:00+00:00" : TIMES.solarNoon,
            sunrise: east ? "2026-06-20T19:25:00+00:00" : TIMES.sunrise,
            sunset: east ? "2026-06-21T10:00:00+00:00" : TIMES.sunset,
          },
          status: "OK",
        }),
      } as Response;
    });
    const west = await loadSunTimes({ dayOfYear: 172, latitude: 35.7, longitude: -74 }, 2026, fetcher as unknown as typeof fetch);
    const east = await loadSunTimes({ dayOfYear: 172, latitude: 35.7, longitude: 139.7 }, 2026, fetcher as unknown as typeof fetch);
    expect(urls[0]).toContain("lng=-74");
    expect(urls[1]).toContain("lng=139.7");
    expect(draw({ times: east }).texts()).toContain(formatClockTime(east.solarNoon));
    expect(formatClockTime(east.solarNoon)).not.toBe(formatClockTime(west.solarNoon));
    // Longitude never changes the arc shape, only the clock times
    expect(sunArcGeometry({ dayOfYear: 172, height: 1080, latitude: 35.7, width: 1920 })).toEqual(
      sunArcGeometry({ dayOfYear: 172, height: 1080, latitude: 35.7, width: 1920 }),
    );
  });

  it("city presets set latitude and longitude", () => {
    for (const city of CITY_PRESETS) {
      const dispatch = vi.fn();
      handlePanelAction({
        action: { label: city.label, value: city.value },
        dispatch,
        reportProgress: () => {},
        state: stateWith(),
      });
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ target: SOL_TARGETS.latitude, type: "controls.setValue", value: city.latitude }));
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ target: SOL_TARGETS.longitude, type: "controls.setValue", value: city.longitude }));
    }
  });

  it("day of year moves the arc with the season", () => {
    const june = sunArcGeometry({ dayOfYear: 172, height: 1080, latitude: 40.7, width: 1920 });
    const december = sunArcGeometry({ dayOfYear: 355, height: 1080, latitude: 40.7, width: 1920 });
    expect(june.controlY).toBeLessThan(december.controlY);
    expect(june.dayEndT - june.dayStartT).toBeGreaterThan(december.dayEndT - december.dayStartT);
  });

  it("excluding the background leaves the sky transparent", () => {
    expect(fullCanvasFills(draw({ includeBackground: true }), 1920, 1080)).toHaveLength(1);
    expect(fullCanvasFills(draw({ includeBackground: false }), 1920, 1080)).toHaveLength(0);
    // Export follows the switch too: no fill before the scene is drawn
    const canvas = exportCanvas({ [SOL_TARGETS.includeBackground]: false });
    expect(fullCanvasFills(canvas.context, canvas.width, canvas.height)).toHaveLength(0);
    expect(fullCanvasFills(canvas.context, 1920, 1080)).toHaveLength(0);
  });

  it("sky colour drives the background gradient", () => {
    const warm = draw({ background: "#f4c27a" });
    expect(warm.gradients[0]?.stops.map(([, color]) => color)).toContain(shadeColor("#f4c27a", 0));
    expect(shadeColor("#f4c27a", 0)).toBe("rgb(244, 194, 122)");
    expect(draw().gradients[0]?.stops).not.toEqual(warm.gradients[0]?.stops);
  });

  it("image format selects the export encoder", () => {
    expect(exportMimeType(stateWith({ [SOL_TARGETS.imageFormat]: "png" }))).toBe("image/png");
    expect(exportMimeType(stateWith({ [SOL_TARGETS.imageFormat]: "jpg" }))).toBe("image/jpeg");
  });

  it("image resolution sets the exported pixel size", () => {
    expect(exportCanvas({ [SOL_TARGETS.imageResolution]: "2k" }).width).toBe(2048);
    expect(exportCanvas({ [SOL_TARGETS.imageResolution]: "4k" }).width).toBe(4096);
    const eightK = exportCanvas({ [SOL_TARGETS.imageResolution]: "8k" });
    expect([eightK.width, eightK.height]).toEqual([8192, 4608]);
  });

  it("export renders the current scene at the selected size", async () => {
    const canvas = exportCanvas();
    expect([canvas.width, canvas.height]).toEqual([4096, 2304]);
    const texts = canvas.context.texts();
    expect(texts).toContain(formatDayLength(TIMES.dayLengthSeconds));
    expect(texts).toContain(formatClockTime(TIMES.sunrise));
    expect(texts).toContain("DAY LENGTH");
    expect(EXPORT_PNG_ACTION).toBe("export-png");
  });
});

// ─── Model details ───

describe("Sol model", () => {
  it("falls back to a computed estimate when the API fails", async () => {
    clearSunTimesCache();
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    const times = await loadSunTimes({ dayOfYear: 172, latitude: 40.7, longitude: -74 }, 2026, failing as unknown as typeof fetch);
    expect(times.source).toBe("computed");
    expect(times.dayLengthSeconds).toBeCloseTo(dayLengthHours(40.7, 172) * 3600);
  });

  it("reads the sky colour from the Color control's { hex } value", () => {
    expect(readSunPathSettings({ [SOL_TARGETS.background]: { hex: "#F4C27A" } }).background).toBe("#F4C27A");
    expect(readSunPathSettings({ [SOL_TARGETS.background]: "#112233" }).background).toBe("#112233");
    expect(readSunPathSettings({}).background).toBe(SOL_DEFAULTS.background);
  });

  it("rejects malformed API answers", () => {
    expect(parseSunriseSunsetResponse({ status: "INVALID_REQUEST" })).toBeNull();
    expect(parseSunriseSunsetResponse(null)).toBeNull();
  });

  it("parks the sun at sunrise or sunset at night", () => {
    const times = computeSunTimes({ dayOfYear: 172, latitude: 40.7, longitude: -74 }, 2026);
    expect(sunProgress(times, new Date(times.solarNoon).getTime())).toBeCloseTo(0.5, 2);
    expect(sunProgress(times, new Date(times.sunset).getTime() + 60_000)).toBe(1);
    expect(sunProgress(times, new Date(times.sunrise).getTime() - 60_000)).toBe(0);
  });

  it("labels polar night and midnight sun instead of meaningless times", () => {
    const night = { ...TIMES, dayLengthSeconds: 0 };
    expect(draw({ latitude: 80, dayOfYear: 355, times: night }).texts()).toContain("polar night");
    const midnightSun = { ...TIMES, dayLengthSeconds: 86_400 };
    expect(draw({ latitude: 80, times: midnightSun }).texts()).toContain("midnight sun");
  });
});

// ─── Performance (automated side of each performance scenario) ───

describe("Sol performance", () => {
  it("perf: latitude redraw stays cheap", () => {
    for (const latitude of [-90, -40, 0, 40.7, 90]) {
      expect(drawOpCount({ latitude })).toBeLessThan(CHEAP_REDRAW_OPS);
    }
  });

  it("perf: longitude redraw stays cheap", () => {
    // Longitude only changes the cached API times; the scene draws the same amount of work
    expect(drawOpCount({ times: { ...TIMES, solarNoon: "2026-06-21T02:42:00.000Z" } })).toBeLessThan(CHEAP_REDRAW_OPS);
  });

  it("perf: day of year redraw stays cheap", () => {
    for (const dayOfYear of [1, 80, 172, 266, 365]) {
      expect(drawOpCount({ dayOfYear })).toBeLessThan(CHEAP_REDRAW_OPS);
    }
  });

  it("perf: city presets apply in one redraw", () => {
    const dispatch = vi.fn();
    handlePanelAction({ action: { value: "city-reykjavik" }, dispatch, reportProgress: () => {}, state: stateWith() });
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("perf: background include toggles without delay", () => {
    expect(drawOpCount({ includeBackground: false })).toBeLessThanOrEqual(drawOpCount({ includeBackground: true }));
  });

  it("perf: sky colour recolours without delay", () => {
    expect(drawOpCount({ background: "#f4c27a" })).toBe(drawOpCount({ background: "#e8f4f8" }));
  });

  it("perf: image format change does not redraw", () => {
    const formatRule = appPerformance.rendererPipeline?.interactionInvalidation.find((rule) =>
      rule.targets.includes(SOL_TARGETS.imageFormat),
    );
    expect(formatRule?.invalidates).toEqual([]);
    const before = readSunPathSettings(stateWith().values);
    const after = readSunPathSettings(stateWith({ [SOL_TARGETS.imageFormat]: "jpg" }).values);
    expect({ ...after, imageFormat: before.imageFormat }).toEqual(before);
  });

  it("perf: image resolution covers 2K to 8K", () => {
    const resolution = appSchema.panels.controls?.sections
      .flatMap((section) => Object.values(section.controls))
      .find((control) => control.target === SOL_TARGETS.imageResolution);
    expect(resolution?.options?.map((option) => option.value)).toEqual(["2k", "4k", "8k"]);
    expect(exportCanvas({ [SOL_TARGETS.imageResolution]: "2k" }).width).toBeLessThan(exportCanvas({ [SOL_TARGETS.imageResolution]: "8k" }).width);
  });

  it("perf: 8K export renders within budget", () => {
    const canvas = exportCanvas({ [SOL_TARGETS.imageResolution]: "8k" });
    expect(canvas.width).toBe(8192);
    expect(canvas.context.ops.length).toBeLessThan(CHEAP_REDRAW_OPS);
  });

  it("perf: preview draws at full render scale", () => {
    expect(readSunPathSettings(stateWith().values).renderScale).toBe(2);
    expect(appSchema.canvas.renderScale.enabled).toBe(true);
    expect(drawOpCount()).toBeLessThan(CHEAP_REDRAW_OPS);
  });

  it("perf: zooming does not redraw the scene", () => {
    const zoomRule = appPerformance.rendererPipeline?.interactionInvalidation.find((rule) => rule.interaction === "viewport-zoom");
    expect(zoomRule?.invalidates).toEqual([]);
    expect(zoomRule?.mustNotInvalidate).toContain("sun-path-raster");
  });
});
