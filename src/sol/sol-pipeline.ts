import { registerToolcraftRendererPipeline, type ToolcraftRendererPipelinePassContract } from "@/toolcraft/runtime";

import type { SolRasterClient } from "./sol-raster-client";
import { SOL_RENDER_TARGETS, SOL_TARGETS } from "./sol-settings";

const sceneTargets = [SOL_TARGETS.latitude, SOL_TARGETS.longitude, SOL_TARGETS.dayOfYear, SOL_TARGETS.time];
const rasterInputs = [...SOL_RENDER_TARGETS, "canvas.size.width", "canvas.size.height", "canvas.renderScale", "canvas.zoom"];

export const solPipeline = registerToolcraftRendererPipeline<{
  export: ToolcraftRendererPipelinePassContract<void>;
  raster: ToolcraftRendererPipelinePassContract<string | null, SolRasterClient, readonly ["sol"]>;
}>()({
  interactionInvalidation: [
    { interaction: "initial-render", invalidates: ["raster"], targets: ["canvas"] },
    { interaction: "control-drag", invalidates: ["raster"], targets: [...sceneTargets, "canvas.renderScale"] },
    {
      interaction: "control-change",
      invalidates: ["raster"],
      targets: [SOL_TARGETS.cityPreset, SOL_TARGETS.season, SOL_TARGETS.moment, SOL_TARGETS.background, SOL_TARGETS.includeBackground, "canvas.size.width", "canvas.size.height"],
    },
    { interaction: "control-change", invalidates: [], mustNotInvalidate: ["raster"], targets: ["canvas.infinity", "canvas.workspaceBackground", "export.image.format", "export.image.resolution"] },
    { interaction: "viewport-drag", invalidates: [], mustNotInvalidate: ["raster"], targets: ["canvas"] },
    { interaction: "viewport-zoom", invalidates: ["raster"], targets: ["canvas"] },
    { interaction: "export", invalidates: ["export"], mustNotInvalidate: ["raster"], targets: ["export.image"] },
  ],
  passes: [
    {
      cacheKey: ["request"],
      cost: { dimensions: ["width", "height", "scale", "zoom"], frequency: "interaction", relationship: "product" },
      id: "raster",
      inputs: rasterInputs,
      invalidatedBy: rasterInputs,
      kind: "rasterize",
      lifecycle: { cache: "retained-resource", resourceScope: "renderer" },
      output: "preview",
      quality: "retina",
      runsOn: "worker",
      sceneBounds: {
        kind: "intrinsic",
        reason: "Sol is a poster laid out inside its artboard: every chart, label and margin is positioned from the frame size, so no content exists outside it.",
      },
    },
    {
      cost: { dimensions: ["resolution"], frequency: "batch", relationship: "product" },
      id: "export",
      inputs: [...SOL_RENDER_TARGETS, "export.image.resolution"],
      invalidatedBy: ["export.image"],
      kind: "export",
      lifecycle: { cache: "none", resourceScope: "call" },
      output: "export",
      quality: "export",
      runsOn: "export-only",
    },
  ],
  runtimeId: "sol-sun-chart-v1",
});

export const rasterPass = solPipeline.getPass("raster");
export const exportPass = solPipeline.getPass("export");
