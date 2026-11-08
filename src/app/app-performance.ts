import { defineToolcraftPerformance, deriveToolcraftPerformancePaths, type ToolcraftPerformanceScenario } from "@/toolcraft/runtime";

import { solPerformanceModel } from "../sol/sol-performance-model";
import { appSchema } from "./app-schema";

export const solPerformancePaths = deriveToolcraftPerformancePaths(appSchema, solPerformanceModel);

export const appPerformance = defineToolcraftPerformance({
  ...solPerformanceModel,
  scenarios: solPerformancePaths.map(
    (path, index): ToolcraftPerformanceScenario =>
      ({
        automated: true,
        automatedTestName: "sol render plan has valid derived paths and fixtures",
        browser: true,
        browserTestName: `browser perf: toolcraft path ${path.id}`,
        coversTargets: path.targets,
        expectedObservable: "The sun chart, viewport or decoded artifact reflects the exact applied operation.",
        fixture: "Compiled reachable sol workload",
        id: `sol-path-${index}`,
        interaction: path.interaction,
        pathId: path.id,
        uiSelector: '[data-testid="sol-output"]',
        ...(path.interaction === "export" ? { actionValue: "export.png", completionEvidence: "download" as const, controlLabel: "Export PNG" } : {}),
      }) as ToolcraftPerformanceScenario,
  ),
});
