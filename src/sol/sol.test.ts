import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { assessToolcraftRenderPlan, compileToolcraftPerformanceFixturePlan } from "@/toolcraft/runtime";

import { appPerformance, solPerformancePaths } from "../app/app-performance";
import { appSchema } from "../app/app-schema";
import { computeSolDay, formatClock, solarPosition, utcOffsetMinutes } from "./solar";
import { handleSolAction } from "./sol-actions";
import { compassPoint, computeSolScene, drawSol, inkFor } from "./sol-draw";
import { solExport } from "./sol-export";
import { solPerformanceModel } from "./sol-performance-model";
import { solPipeline } from "./sol-pipeline";
import { CITY_PRESETS, NOW_ACTION, SEASON_PRESETS, SOL_TARGETS, SOL_YEAR, readSolSettings } from "./sol-settings";

type Call = unknown[];

/** Records every canvas call so two drawings can be compared exactly. */
function recordingContext(calls: Call[]): CanvasRenderingContext2D {
  let font = "10px sans-serif";
  const handler: ProxyHandler<object> = {
    get: (_target, key) => {
      if (key === "font") return font;
      if (key === "measureText") return (text: string) => ({ width: text.length * (parseFloat(/(\d+(\.\d+)?)px/.exec(font)?.[1] ?? "10") * 0.55) });
      if (key === "createLinearGradient" || key === "createRadialGradient") {
        return (...args: number[]) => {
          const stops: unknown[] = [];
          calls.push([key, args, stops]);
          return { addColorStop: (...stop: unknown[]) => stops.push(stop) };
        };
      }
      return (...args: unknown[]) => calls.push([key, ...args]);
    },
    set: (_target, key, value) => {
      if (key === "font") font = value;
      calls.push([key, value]);
      return true;
    },
  };
  return new Proxy({}, handler) as CanvasRenderingContext2D;
}

function drawCalls(values: Record<string, unknown> = {}, width = 1920, height = 1080): Call[] {
  const settings = readSolSettings(values);
  const calls: Call[] = [];
  drawSol(recordingContext(calls), width, height, settings, computeSolScene(settings));
  return calls;
}

const signature = (calls: Call[]) => createHash("sha256").update(JSON.stringify(calls)).digest("hex");
const texts = (calls: Call[]) => calls.filter((call) => call[0] === "fillText").map((call) => String(call[1]));
const DEFAULT = signature(drawCalls());

function dispatched(value: string, values: Record<string, unknown> = {}, nowMs?: number) {
  const dispatch = vi.fn();
  handleSolAction({ action: { value }, dispatch, state: { values } }, nowMs);
  return dispatch.mock.calls.map(([command]) => command as { target: string; value: unknown });
}

describe("solar model", () => {
  const newYork = { latitude: 40.7128, longitude: -74.006, timeZone: "America/New_York" };

  it("matches the almanac for New York on the June solstice", () => {
    const day = computeSolDay(newYork, 2026, 172);
    const offset = utcOffsetMinutes(newYork, day.solarNoon);
    expect(offset).toBe(-240);
    // NOAA: sunrise 05:25, sunset 20:31, solar noon 12:57 EDT
    expect(Math.abs(toMinutes(formatClock(day.sunrise, offset)) - toMinutes("05:25"))).toBeLessThanOrEqual(2);
    expect(Math.abs(toMinutes(formatClock(day.sunset, offset)) - toMinutes("20:31"))).toBeLessThanOrEqual(2);
    expect(Math.abs(toMinutes(formatClock(day.solarNoon, offset)) - toMinutes("12:57"))).toBeLessThanOrEqual(5);
    expect(day.noonElevation).toBeGreaterThan(72);
    expect(day.noonElevation).toBeLessThan(73.5);
  });

  it("reports polar night and midnight sun without inventing sunrise or sunset", () => {
    const tromso = { latitude: 69.6, longitude: 19, timeZone: "Europe/Oslo" };
    const june = computeSolDay(tromso, 2026, 172);
    expect(june.sunrise).toBeNull();
    expect(june.dayLengthMinutes).toBeGreaterThanOrEqual(1439);
    const december = computeSolDay(tromso, 2026, 355);
    expect(december.sunrise).toBeNull();
    expect(december.dayLengthMinutes).toBe(0);
  });

  it("puts the sun high in the south at northern midsummer noon and below the horizon at midnight", () => {
    const day = computeSolDay(newYork, 2026, 172);
    const noon = solarPosition(newYork.latitude, newYork.longitude, day.solarNoon);
    expect(compassPoint(noon.azimuth)).toBe("S");
    expect(solarPosition(newYork.latitude, newYork.longitude, day.midnightUtc).elevation).toBeLessThan(-20);
  });
});

function toMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
}

describe("Sol controls", () => {
  it("sol control place.latitude", () => {
    const north = drawCalls({ [SOL_TARGETS.latitude]: 64 });
    expect(signature(north)).not.toBe(DEFAULT);
    const nyDay = computeSolDay(readSolSettings({}), SOL_YEAR, 172);
    const northDay = computeSolDay(readSolSettings({ [SOL_TARGETS.latitude]: 64 }), SOL_YEAR, 172);
    expect(northDay.dayLengthMinutes).toBeGreaterThan(nyDay.dayLengthMinutes);
  });

  it("sol control place.longitude", () => {
    const moved = drawCalls({ [SOL_TARGETS.longitude]: 100 });
    expect(signature(moved)).not.toBe(DEFAULT);
    expect(texts(moved).join("")).toContain("UTC+7");
  });

  it("sol control date.dayOfYear", () => {
    const winter = drawCalls({ [SOL_TARGETS.dayOfYear]: 355 });
    expect(texts(winter)).toContain("21 December");
    expect(signature(winter)).not.toBe(DEFAULT);
  });

  it("sol control time.hour", () => {
    const morning = drawCalls({ [SOL_TARGETS.time]: 8 });
    expect(texts(morning)).toContain("08:00");
    expect(signature(morning)).not.toBe(DEFAULT);
  });

  it("sol control place.city", () => {
    for (const city of CITY_PRESETS) {
      const commands = dispatched(city.value);
      expect(commands).toEqual([
        expect.objectContaining({ target: SOL_TARGETS.latitude, value: city.latitude }),
        expect.objectContaining({ target: SOL_TARGETS.longitude, value: city.longitude }),
      ]);
      const drawn = texts(drawCalls({ [SOL_TARGETS.latitude]: city.latitude, [SOL_TARGETS.longitude]: city.longitude }));
      expect(drawn.join("")).toContain(city.label.toUpperCase()[0]);
    }
    expect(readSolSettings({ [SOL_TARGETS.latitude]: 35.7, [SOL_TARGETS.longitude]: 139.7 }).timeZone).toBe("Asia/Tokyo");
  });

  it("sol control date.season", () => {
    for (const season of SEASON_PRESETS) {
      expect(dispatched(season.value)).toEqual([expect.objectContaining({ target: SOL_TARGETS.dayOfYear, value: season.dayOfYear })]);
    }
  });

  it("sol control time.moment", () => {
    // 2026-03-01 15:30 UTC is 10:30 in New York (UTC-5 before DST)
    const commands = dispatched(NOW_ACTION, { [SOL_TARGETS.latitude]: 40.7, [SOL_TARGETS.longitude]: -74 }, Date.UTC(2026, 2, 1, 15, 30));
    expect(commands).toEqual([
      expect.objectContaining({ target: SOL_TARGETS.dayOfYear, value: 60 }),
      expect.objectContaining({ target: SOL_TARGETS.time, value: 10.5 }),
    ]);
  });
});

describe("Sol contracts", () => {
  it("sol contract appearance.background", () => {
    expect(inkFor({ background: "#F3EEE4", includeBackground: true })).toBe("#1C2333");
    expect(inkFor({ background: "#14182B", includeBackground: true })).toBe("#F2EDE4");
    expect(signature(drawCalls({ [SOL_TARGETS.background]: "#14182B" }))).not.toBe(DEFAULT);
  });

  it("sol contract background.output", () => {
    // Product output is a transparent foreground: it never fills the whole frame
    const fullFills = (calls: Call[]) => calls.filter((call) => call[0] === "fillRect" && call[3] === 1920 && call[4] === 1080);
    expect(fullFills(drawCalls())).toHaveLength(0);
    expect(fullFills(drawCalls({ [SOL_TARGETS.includeBackground]: false }))).toHaveLength(0);
    expect(inkFor({ background: "#14182B", includeBackground: false })).toBe("#1C2333");
  });

  it("sol contract export.image.format", () => {
    const format = appSchema.panels.controls?.sections.flatMap((section) => Object.values(section.controls)).find((control) => control.target === "export.image.format");
    expect(format?.options?.map((option) => option.value)).toEqual(["png", "jpg"]);
  });

  it("sol contract export.image.resolution", () => {
    const resolution = appSchema.panels.controls?.sections.flatMap((section) => Object.values(section.controls)).find((control) => control.target === "export.image.resolution");
    expect(resolution?.options?.map((option) => option.value)).toEqual(["2k", "4k", "8k"]);
  });

  it("sol contract export.image", async () => {
    const calls: Call[] = [];
    const controller = new AbortController();
    await solExport.renderFrame({
      context: recordingContext(calls),
      frame: { height: 1080, width: 1920, x: -960, y: -540 },
      signal: controller.signal,
      state: { values: {} },
    } as unknown as Parameters<typeof solExport.renderFrame>[0]);
    expect(calls[1]).toEqual(["translate", -960, -540]);
    expect(texts(calls)).toContain("21 June");
  });

  it("sol contract export.infinity", () => {
    // The poster lives entirely inside its frame, so finite and Infinity exports are the same picture
    const pass = solPipeline.passes.find((candidate) => candidate.id === "raster");
    expect(pass?.sceneBounds?.kind).toBe("intrinsic");
  });

  it("sol contract canvas.size", () => {
    expect(signature(drawCalls({}, 960, 540))).not.toBe(DEFAULT);
  });

  it("sol contract canvas.scale", () => {
    const raster = solPipeline.passes.find((candidate) => candidate.id === "raster");
    expect(raster?.invalidatedBy).toContain("canvas.renderScale");
    expect(raster?.quality).toBe("retina");
    expect(appSchema.canvas.renderScale.enabled).toBe(true);
  });

  it("sol contract canvas.infinity", () => {
    const rule = solPipeline.interactionInvalidation.find((entry) => entry.targets.includes("canvas.infinity"));
    expect(rule?.invalidates).toEqual([]);
  });

  it("sol render plan has valid derived paths and fixtures", () => {
    const assessment = assessToolcraftRenderPlan(appSchema, solPerformanceModel);
    expect(assessment.errors ?? []).toEqual([]);
    expect(solPerformancePaths.length).toBe(appPerformance.scenarios.length);
    for (const path of solPerformancePaths) {
      if (path.workloadDimensions.length) expect(() => compileToolcraftPerformanceFixturePlan(solPerformanceModel, path)).not.toThrow();
    }
  });
});
