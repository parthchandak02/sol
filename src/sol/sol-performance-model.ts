import type { ToolcraftEnvelopePerformanceConfig, ToolcraftPerformanceFixtureAdapter } from "@/toolcraft/runtime";

import { solPipeline } from "./sol-pipeline";

const numeric = (dimensionId: string): ToolcraftPerformanceFixtureAdapter => ({ apply: (value) => value, dimensionId, observe: (value) => Number(value) });
const resolutionValues: Record<string, number> = { "2k": 2048, "4k": 4096, "8k": 8192 };

export const solPerformanceModel = {
  fixtureAdapters: {
    dimensions: {
      height: numeric("height"),
      resolution: {
        apply: (value) => Object.keys(resolutionValues).find((key) => resolutionValues[key] === value)!,
        dimensionId: "resolution",
        domain: { kind: "schema-options", optionValues: ["2k", "4k", "8k"], target: "export.image.resolution" },
        entries: Object.entries(resolutionValues).map(([appliedValue, value]) => ({ appliedValue, value })),
        kind: "exhaustive-discrete",
        observe: (value) => resolutionValues[String(value)]!,
      },
      scale: numeric("scale"),
      width: numeric("width"),
      zoom: numeric("zoom"),
    },
  },
  rendererPipeline: solPipeline,
  rendererStrategy: "canvas-2d",
  rendererTechnique: {
    exportRenderer: "canvas-2d",
    fidelityRisks: [
      "Text is rasterized; the worker redraws at the exact zoomed backing size so type stays sharp at every zoom and Resolution scale.",
      "Canvas fonts fall back to system serif/sans faces when the preferred faces are missing.",
    ],
    intentionalRasterizationReason: "The chart, sun and typography form one poster that exports as one image; one Canvas 2D drawing serves preview and export.",
    layers: [
      {
        content: ["geometry", "text"],
        exportMode: "included",
        id: "sun-chart",
        intentionalRasterizationReason: "Single composed poster shared with the image export.",
        kind: "product-foreground",
        primitiveCount: "low",
        renderer: "canvas-2d",
        uiSelector: '[data-testid="sol-output"]',
      },
    ],
    performanceRisks: ["Backing size grows with zoom and Resolution scale; rasterization runs in a worker and only the newest pending request is drawn."],
    previewRenderer: "canvas-2d",
    productRepresentation: "mixed",
    rendererStrategy: "canvas-2d",
    sourceRepresentation: "procedural-data",
    whyNotAlternativeStrategies: [
      "SVG would keep text as vectors but needs a second rasterizing path for PNG/JPG export.",
      "WebGL adds nothing for a few hundred strokes and a dozen text runs.",
    ],
  },
  scenarios: [],
  usesCustomRenderer: true,
  workloadEnvelope: {
    dimensions: [
      { defaultValue: 1920, id: "width", interactiveMax: 8192, mapping: "direct", source: { kind: "runtime-state", path: "canvas.size.width" }, unit: "scene pixels" },
      { defaultValue: 1080, id: "height", interactiveMax: 8192, mapping: "direct", source: { kind: "runtime-state", path: "canvas.size.height" }, unit: "scene pixels" },
      { defaultValue: 2, id: "scale", interactiveMax: 2, mapping: "area", source: { kind: "runtime-state", path: "values.canvas.renderScale" }, unit: "backing multiplier" },
      { defaultValue: 100, id: "zoom", interactiveMax: 400, mapping: "area", source: { kind: "runtime-state", path: "canvas.zoom" }, unit: "percent" },
      { batchMax: 8192, defaultValue: 4096, id: "resolution", mapping: "area", source: { kind: "schema-target", target: "export.image.resolution" }, unit: "long-edge pixels" },
    ],
  },
} as const satisfies ToolcraftEnvelopePerformanceConfig;
