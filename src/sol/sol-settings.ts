// Sol's schema targets, defaults, presets, and typed view of runtime values.

import type { SolPlace } from "./solar";

export const SOL_YEAR = 2026;

export const SOL_TARGETS = {
  background: "appearance.background",
  cityPreset: "place.city",
  dayOfYear: "date.dayOfYear",
  includeBackground: "export.includeBackground",
  latitude: "place.latitude",
  longitude: "place.longitude",
  moment: "time.moment",
  season: "date.season",
  time: "time.hour",
} as const;

export const SOL_DEFAULTS = {
  background: "#F3EEE4",
  dayOfYear: 172,
  latitude: 40.7,
  longitude: -74,
  time: 17,
} as const;

export const CITY_PRESETS = [
  { label: "New York", latitude: 40.7, longitude: -74, timeZone: "America/New_York", value: "city-new-york" },
  { label: "London", latitude: 51.5, longitude: -0.1, timeZone: "Europe/London", value: "city-london" },
  { label: "Tokyo", latitude: 35.7, longitude: 139.7, timeZone: "Asia/Tokyo", value: "city-tokyo" },
  { label: "Singapore", latitude: 1.3, longitude: 103.8, timeZone: "Asia/Singapore", value: "city-singapore" },
  { label: "Reykjavík", latitude: 64.1, longitude: -21.9, timeZone: "Atlantic/Reykjavik", value: "city-reykjavik" },
  { label: "Cape Town", latitude: -33.9, longitude: 18.4, timeZone: "Africa/Johannesburg", value: "city-cape-town" },
  { label: "Sydney", latitude: -33.9, longitude: 151.2, timeZone: "Australia/Sydney", value: "city-sydney" },
  { label: "Tromsø", latitude: 69.6, longitude: 19, timeZone: "Europe/Oslo", value: "city-tromso" },
] as const;

/** Day of year for the equinoxes and solstices (2026, rounded to the day). */
export const SEASON_PRESETS = [
  { dayOfYear: 79, label: "Mar equinox", value: "season-march" },
  { dayOfYear: 172, label: "Jun solstice", value: "season-june" },
  { dayOfYear: 266, label: "Sep equinox", value: "season-september" },
  { dayOfYear: 355, label: "Dec solstice", value: "season-december" },
] as const;

export const NOW_ACTION = "time-now";

export type SolSettings = SolPlace & {
  background: string;
  dayOfYear: number;
  includeBackground: boolean;
  placeName: string | null;
  time: number;
};

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** A place matches a preset only when both coordinates match it exactly (to the slider step). */
export function presetFor(latitude: number, longitude: number) {
  return CITY_PRESETS.find(
    (city) => Math.abs(city.latitude - latitude) < 0.05 && Math.abs(city.longitude - longitude) < 0.05,
  );
}

export function readSolSettings(values: Readonly<Record<string, unknown>>): SolSettings {
  const latitude = num(values[SOL_TARGETS.latitude], SOL_DEFAULTS.latitude);
  const longitude = num(values[SOL_TARGETS.longitude], SOL_DEFAULTS.longitude);
  const preset = presetFor(latitude, longitude);
  const background = values[SOL_TARGETS.background];
  return {
    background: typeof background === "string" ? background : SOL_DEFAULTS.background,
    dayOfYear: num(values[SOL_TARGETS.dayOfYear], SOL_DEFAULTS.dayOfYear),
    includeBackground: values[SOL_TARGETS.includeBackground] !== false,
    latitude,
    longitude,
    placeName: preset?.label ?? null,
    time: num(values[SOL_TARGETS.time], SOL_DEFAULTS.time),
    timeZone: preset?.timeZone ?? null,
  };
}

export const SOL_RENDER_TARGETS = [
  SOL_TARGETS.latitude,
  SOL_TARGETS.longitude,
  SOL_TARGETS.dayOfYear,
  SOL_TARGETS.time,
  SOL_TARGETS.background,
  SOL_TARGETS.includeBackground,
] as const;
