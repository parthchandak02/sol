import type {
  ToolcraftComponentAcceptance,
  ToolcraftControlSectionInventoryEntry,
  ToolcraftProductReadiness,
  ToolcraftTransferMode,
} from "./acceptance/types";
import { appSchema } from "./app-schema";
import { solReadiness, solSectionInventory } from "../sol/sol-inventory";
import { CITY_PRESETS, NOW_ACTION, SEASON_PRESETS, SOL_TARGETS } from "../sol/sol-settings";

export const appTransferMode: ToolcraftTransferMode = {
  animationIntent: { mode: "none" },
  mode: "new-toolcraft-app",
  referenceInputs: [],
};

export const appProductReadiness: ToolcraftProductReadiness = solReadiness;

export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] = solSectionInventory;

type Budget = "extended-io" | "standard";
const browser = (testName: string, file: `e2e/${string}.spec.ts`, budget: Budget = "standard") => ({ budget, file, testName });

const domainFile = (id: string) => `e2e/product-sol-${id.split(".")[0]}.spec.ts` as const;

const sliderRow = (id: string, target: string, label: string, observable: string, interactionId: string): ToolcraftComponentAcceptance => ({
  automated: true,
  automatedTestName: `sol control ${target}`,
  browser: browser(`browser: sol control ${target}`, domainFile(id)),
  componentType: "slider",
  evidence: "product-output",
  expectedObservable: observable,
  fixture: "Default New York, 21 June, 17:00",
  id,
  interactionId,
  kind: "control",
  target,
  userAction: `Drag the ${label} slider.`,
});

const actionRow = (id: string, target: string, values: readonly string[], observable: string, interactionId: string): ToolcraftComponentAcceptance => ({
  actionCoverage: values,
  automated: true,
  automatedTestName: `sol control ${target}`,
  browser: browser(`browser: sol control ${target}`, domainFile(id)),
  componentType: "actions",
  evidence: "product-output",
  expectedObservable: observable,
  fixture: "Default New York, 21 June, 17:00",
  id,
  interactionId,
  kind: "control",
  target,
  userAction: "Click every button.",
});

const runtimeRow = (id: string, target: string, evidence: ToolcraftComponentAcceptance["evidence"], testName: string, file: `e2e/${string}.spec.ts`, budget: Budget = "standard"): ToolcraftComponentAcceptance => ({
  automated: true,
  automatedTestName: `sol contract ${id}`,
  browser: browser(testName, file, budget),
  componentType: id,
  evidence,
  expectedObservable: `The real product output and runtime workspace implement ${id}.`,
  fixture: "Default settings and real Toolcraft controls",
  id,
  kind: "runtime",
  target,
  userAction: `Exercise ${id} through its visible controls.`,
});

const exportTest = "browser: sol image export delivers every format and size";

export const appAcceptance: readonly ToolcraftComponentAcceptance[] = [
  sliderRow("place.latitude", SOL_TARGETS.latitude, "Latitude", "Moving toward the pole flattens or raises the curve and changes the day length on the poster.", "latitude-property"),
  sliderRow("place.longitude", SOL_TARGETS.longitude, "Longitude", "The curve slides along the local clock and the time zone label changes.", "longitude-property"),
  sliderRow("date.dayOfYear", SOL_TARGETS.dayOfYear, "Day of year", "The curve height, day length and year-strip marker change with the season.", "day-property"),
  sliderRow("time.hour", SOL_TARGETS.time, "Time of day", "The sun moves along the curve and its time and elevation labels change.", "time-property"),
  actionRow("place.city", SOL_TARGETS.cityPreset, CITY_PRESETS.map((city) => city.value), "Each city sets both location sliders and the poster names the city and its time zone.", "city-command"),
  actionRow("date.season", SOL_TARGETS.season, SEASON_PRESETS.map((season) => season.value), "Each season shortcut moves the day of year and redraws the curve and year marker.", "season-command"),
  actionRow("time.moment", SOL_TARGETS.moment, [NOW_ACTION], "Now moves the day and the sun to the current moment at the place.", "now-command"),
  {
    ...runtimeRow("appearance.background", SOL_TARGETS.background, "product-output", "browser: sol background color changes output", "e2e/product-sol-appearance.spec.ts"),
    componentType: "color",
    interactionId: "background-color-property",
    kind: "control",
  },
  {
    ...runtimeRow("background.output", SOL_TARGETS.includeBackground, "product-output", "browser: sol background output follows runtime semantics", "e2e/product-sol-background.spec.ts"),
    backgroundOutputCoverage: "all-required-background-output",
    componentType: "switch",
    interactionId: "background-include-property",
    kind: "control",
  },
  ...(["format", "resolution"] as const).map(
    (key): ToolcraftComponentAcceptance => ({
      ...runtimeRow(`export.image.${key}`, `export.image.${key}`, "exported-bytes", exportTest, "e2e/product-sol-export.spec.ts", "extended-io"),
      componentType: "select",
      kind: "control",
      optionCoverage: key === "format" ? ["png", "jpg"] : ["2k", "4k", "8k"],
    }),
  ),
  {
    ...runtimeRow("export.image", "actions.output", "exported-bytes", exportTest, "e2e/product-sol-export.spec.ts", "extended-io"),
    actionCoverage: ["export.png"],
    componentType: "panelActions",
    kind: "control",
    exportArtifactCoverage: "all-required-image-export-behavior",
  },
  {
    ...runtimeRow("export.infinity", "actions.output", "exported-bytes", exportTest, "e2e/product-sol-export.spec.ts", "extended-io"),
    infinityCanvasCoverage: "scene-bounds-image-export",
  },
  {
    ...runtimeRow("canvas.size", "canvas.size.width", "product-output", "browser: sol canvas sizing changes output", "e2e/product-sol-canvas.spec.ts"),
  },
  {
    ...runtimeRow("canvas.scale", "canvas.renderScale", "product-output", "browser: sol backing preserves selected render scale", "e2e/product-sol-canvas.spec.ts"),
    renderScaleCoverage: { kind: "selected-backing-pixels", states: ["interaction", "steady"] },
  },
  {
    ...runtimeRow("canvas.infinity", "canvas.infinity", "viewport-side-effect", "browser: sol infinity preserves scene and viewport", "e2e/product-sol-canvas.spec.ts"),
    infinityCanvasCoverage: "mode-continuity-and-restoration",
  },
  {
    automated: true,
    automatedTestName: "declares production reload coverage for the starter schema",
    browser: {
      budget: "extended-io",
      file: "e2e/product-sol-persistence.spec.ts",
      testName: "browser: sol restores poster and workspace after reload",
    },
    componentType: "persistence",
    evidence: "persistence-state",
    expectedObservable: "Canvas size, zoom, the chosen city and the moved, collapsed Controls panel are restored after a real reload, and the poster matches its pre-reload pixels.",
    fixture: "Sol persisted workspace",
    id: "persistence.reload",
    kind: "runtime",
    persistenceCoverage: "reload",
    persistenceSlices: appSchema.persistence.storage === "localStorage" ? appSchema.persistence.include : [],
    target: "canvas.size.width",
    userAction: "Change Canvas width, pick Tokyo, zoom in, move and collapse Controls, wait for persistence, and reload the page.",
  },
];
