import type { ToolcraftControlSchema } from "@/toolcraft/runtime";

import { CITY_PRESETS, NOW_ACTION, SEASON_PRESETS, SOL_DEFAULTS, SOL_TARGETS } from "./sol-settings";

const live = {
  applicability: { mode: "always" },
  keyframeable: false,
  performanceReason: "Redraws one small Canvas 2D composition; no cached work depends on it.",
  performanceRole: "responsiveness",
} as const;

export const placeControls = {
  latitude: {
    ...live,
    defaultValue: SOL_DEFAULTS.latitude,
    description: "North is positive. Sets how high the sun climbs and how long the day lasts.",
    label: "Latitude",
    max: 90,
    min: -90,
    sliderValueKind: "continuous",
    step: 0.1,
    target: SOL_TARGETS.latitude,
    type: "slider",
    unit: "°",
  },
  longitude: {
    ...live,
    defaultValue: SOL_DEFAULTS.longitude,
    description: "East is positive. Moves the curve along the local clock.",
    label: "Longitude",
    max: 180,
    min: -180,
    sliderValueKind: "continuous",
    step: 0.1,
    target: SOL_TARGETS.longitude,
    type: "slider",
    unit: "°",
  },
  city: {
    actions: CITY_PRESETS.map((city) => ({ label: city.label, value: city.value, variant: "outline" as const })),
    applicability: { mode: "always" },
    performanceReason: "Sets two sliders at once; one redraw of a small composition.",
    performanceRole: "responsiveness",
    description: "Sets latitude and longitude to the city; times then use its own time zone.",
    label: "Cities",
    target: SOL_TARGETS.cityPreset,
    type: "actions",
  },
} as const satisfies Record<string, ToolcraftControlSchema>;

export const dayControls = {
  dayOfYear: {
    ...live,
    defaultValue: SOL_DEFAULTS.dayOfYear,
    description: "1 is 1 January. The year strip under the chart marks the chosen day.",
    label: "Day of year",
    max: 365,
    min: 1,
    sliderValueKind: "continuous",
    step: 1,
    target: SOL_TARGETS.dayOfYear,
    type: "slider",
  },
  season: {
    actions: SEASON_PRESETS.map((season) => ({ label: season.label, value: season.value, variant: "outline" as const })),
    applicability: { mode: "always" },
    label: "Seasons",
    performanceReason: "Sets the day slider; one redraw of a small composition.",
    performanceRole: "responsiveness",
    target: SOL_TARGETS.season,
    type: "actions",
  },
  time: {
    ...live,
    defaultValue: SOL_DEFAULTS.time,
    description: "Local clock time at the place, in hours after midnight. Moves the sun along the curve.",
    label: "Time of day",
    max: 24,
    min: 0,
    sliderValueKind: "continuous",
    step: 0.25,
    target: SOL_TARGETS.time,
    type: "slider",
    unit: "h",
  },
  moment: {
    actions: [{ label: "Now", value: NOW_ACTION, variant: "outline" as const }],
    applicability: { mode: "always" },
    label: "Current moment",
    performanceReason: "Sets the day and time sliders; one redraw of a small composition.",
    performanceRole: "responsiveness",
    target: SOL_TARGETS.moment,
    type: "actions",
  },
} as const satisfies Record<string, ToolcraftControlSchema>;

export const backgroundControls = {
  include: {
    ...live,
    defaultValue: true,
    label: "Background",
    target: SOL_TARGETS.includeBackground,
    type: "switch",
  },
  color: {
    ...live,
    defaultValue: SOL_DEFAULTS.background,
    label: "Background color",
    target: SOL_TARGETS.background,
    type: "color",
  },
} as const satisfies Record<string, ToolcraftControlSchema>;
