import type { ToolcraftControlSectionInventoryEntry, ToolcraftProductReadiness } from "../app/acceptance/types";
import { SOL_TARGETS } from "./sol-settings";

export const solSectionInventory = [
  {
    entity: "Output background",
    entityId: "background",
    finiteSelectors: [{ reason: "Shows or hides the background fill and PNG alpha; the color stays editable either way.", role: "parameter", target: SOL_TARGETS.includeBackground }],
    groupingReason: "One output background; runtime relocates this source pair into Settings.",
    id: "runtime.setup",
    targets: [SOL_TARGETS.includeBackground, SOL_TARGETS.background],
    title: "Settings",
  },
  {
    entity: "Place on Earth",
    entityId: "place",
    finiteSelectors: [],
    groupingReason: "Latitude, longitude and the city shortcuts all choose where the sun is seen from; cities only set those two sliders and pick the time zone.",
    id: "place",
    targets: [SOL_TARGETS.latitude, SOL_TARGETS.longitude, SOL_TARGETS.cityPreset],
    title: "Place",
  },
  {
    entity: "Moment",
    entityId: "moment",
    finiteSelectors: [],
    groupingReason: "Day of year and time of day together pick the instant the chart describes; the season and Now shortcuts set those two sliders.",
    id: "moment",
    targets: [SOL_TARGETS.dayOfYear, SOL_TARGETS.season, SOL_TARGETS.time, SOL_TARGETS.moment],
    title: "Moment",
  },
  {
    entity: "Raster image output",
    entityId: "image-export",
    finiteSelectors: [
      { reason: "Selects PNG alpha support or opaque JPEG encoding.", role: "parameter", target: "export.image.format" },
      { reason: "Selects the output long-edge pixel size.", role: "parameter", target: "export.image.resolution" },
    ],
    groupingReason: "Runtime-owned image format and resolution govern one exported artifact.",
    id: "runtime.image-export",
    targets: ["export.image.format", "export.image.resolution"],
    title: "Image Export",
  },
] as const satisfies readonly ToolcraftControlSectionInventoryEntry[];

const panelEdit = (id: string, target: string, detail: string) => ({
  alternative: { reason: "Persistent value controls on the chart would cover the artwork.", surface: "canvas" as const },
  capability: "property-edit" as const,
  evidence: { detail, source: "usability-analysis" as const },
  id,
  reason: "A global setting of the whole chart with no spatial handle on the artwork.",
  selectionScope: { mode: "global" as const },
  surface: "panel" as const,
  target,
});
const panelCommand = (id: string, target: string, detail: string) => ({
  alternative: { reason: "A shortcut command has no position on the chart.", surface: "canvas" as const },
  capability: "command" as const,
  evidence: { detail, source: "usability-analysis" as const },
  id,
  reason: "Shortcuts sit beside the sliders they set.",
  surface: "panel" as const,
  target,
});

export const solReadiness: ToolcraftProductReadiness = {
  exportIntent: { image: { mode: "toolcraft-default" }, svg: { mode: "not-requested" }, video: { mode: "not-requested" } },
  interactionOwnership: [
    panelEdit("latitude-property", SOL_TARGETS.latitude, "Latitude is a single number for the whole chart."),
    panelEdit("longitude-property", SOL_TARGETS.longitude, "Longitude is a single number for the whole chart."),
    panelEdit("day-property", SOL_TARGETS.dayOfYear, "The day is a single number; the year strip shows it but is not a picker."),
    panelEdit("time-property", SOL_TARGETS.time, "The time is a single number; the chart shows the sun at that time."),
    panelEdit("background-color-property", SOL_TARGETS.background, "Runtime places the background color in Settings."),
    panelEdit("background-include-property", SOL_TARGETS.includeBackground, "Runtime places the Background switch in Settings."),
    panelCommand("city-command", SOL_TARGETS.cityPreset, "City buttons set latitude, longitude and time zone."),
    panelCommand("season-command", SOL_TARGETS.season, "Season buttons set the day of year."),
    panelCommand("now-command", SOL_TARGETS.moment, "Now sets day and time to the current moment at the place."),
  ],
  mode: "product",
  productName: "Sol",
  productSummary:
    "A poster of one day of sunlight at a chosen place: the sun's elevation through 24 hours with twilight bands, the day length, sunrise, sunset, solar noon and golden hour, and day length through the whole year.",
  requestedBehavior:
    "Rebuild Sol on the current Toolcraft with a much better design: choose a place (sliders or cities), a day (slider or season shortcuts) and a time (slider or Now), see the sun move along a true elevation curve with all times in the place's own time zone, and export the poster as an image.",
  viewInteraction: { mode: "non-spatial", reason: "The output is a two-dimensional chart and typography, not a three-dimensional scene." },
};
