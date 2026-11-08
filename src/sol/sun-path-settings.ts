// Typed view of Sol's runtime values. Schema targets and defaults live here so the schema,
// renderer, export, and tests read the same names.

import { dayOfYearFor } from "./sun-model";

export const SOL_TARGETS = {
  background: "sky.background",
  cityPreset: "location.cityPreset",
  dayOfYear: "date.dayOfYear",
  imageFormat: "export.image.format",
  imageResolution: "export.image.resolution",
  includeBackground: "export.includeBackground",
  latitude: "location.latitude",
  longitude: "location.longitude",
  renderScale: "canvas.renderScale",
} as const;

export const SOL_DEFAULTS = {
  background: "#e8f4f8",
  dayOfYear: dayOfYearFor(new Date()),
  imageFormat: "png",
  imageResolution: "4k",
  includeBackground: true,
  latitude: 40.7,
  longitude: -74,
} as const;

export const CITY_PRESETS = [
  { label: "New York", latitude: 40.7, longitude: -74, value: "city-new-york" },
  { label: "London", latitude: 51.5, longitude: -0.1, value: "city-london" },
  { label: "Tokyo", latitude: 35.7, longitude: 139.7, value: "city-tokyo" },
  { label: "Sydney", latitude: -33.9, longitude: 151.2, value: "city-sydney" },
  { label: "Singapore", latitude: 1.3, longitude: 103.8, value: "city-singapore" },
  { label: "Reykjavik", latitude: 64.1, longitude: -21.9, value: "city-reykjavik" },
  { label: "Cape Town", latitude: -33.9, longitude: 18.4, value: "city-cape-town" },
] as const;

export type SunPathSettings = {
  background: string;
  dayOfYear: number;
  imageFormat: string;
  imageResolution: string;
  includeBackground: boolean;
  latitude: number;
  longitude: number;
  renderScale: number;
};

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** The Color control stores `{ hex }`; older settings files may hold a plain hex string. */
export function readColorValue(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && typeof (value as { hex?: unknown }).hex === "string") {
    return (value as { hex: string }).hex;
  }
  return fallback;
}

export function readSunPathSettings(values: Record<string, unknown>): SunPathSettings {
  const include = values[SOL_TARGETS.includeBackground];
  return {
    background: readColorValue(values[SOL_TARGETS.background], SOL_DEFAULTS.background),
    dayOfYear: numberValue(values[SOL_TARGETS.dayOfYear], SOL_DEFAULTS.dayOfYear),
    imageFormat: String(values[SOL_TARGETS.imageFormat] ?? SOL_DEFAULTS.imageFormat),
    imageResolution: String(values[SOL_TARGETS.imageResolution] ?? SOL_DEFAULTS.imageResolution),
    includeBackground: typeof include === "boolean" ? include : SOL_DEFAULTS.includeBackground,
    latitude: numberValue(values[SOL_TARGETS.latitude], SOL_DEFAULTS.latitude),
    longitude: numberValue(values[SOL_TARGETS.longitude], SOL_DEFAULTS.longitude),
    renderScale: Math.max(1, numberValue(values[SOL_TARGETS.renderScale], 2)),
  };
}
