import { describe, expect, it } from "vitest";

import { appPerformance } from "./app-performance";
import { appSchema } from "./app-schema";

function sectionTitles(): (string | undefined)[] {
  return appSchema.panels.controls?.sections.map((section) => section.title) ?? [];
}

describe("appSchema", () => {
  it("keeps the runtime Setup first, then Sol's product sections in order", () => {
    expect(sectionTitles()).toEqual(["Setup", "Location", "Date", "Background", "Image Export", "Export"]);
    expect(appSchema.panels.controls?.sections[0]?.controls.canvasRenderScale).toMatchObject({
      target: "canvas.renderScale",
    });
  });

  it("uses an editable 1920x1080 output with render scale and no uploads", () => {
    expect(appSchema.canvas.sizing).toEqual({ mode: "editable-output" });
    expect(appSchema.canvas.upload).toBe(false);
    expect(appSchema.canvas.renderScale.enabled).toBe(true);
    expect(appSchema.canvas.size).toMatchObject({ height: 1080, width: 1920 });
  });

  it("has no layers or timeline because Sol is one still picture", () => {
    expect(appSchema.panels.layers).toBeFalsy();
    expect(appSchema.panels.timeline).toBeUndefined();
    expect(appSchema.assembly.capabilities).not.toContain("timeline.playback");
    expect(appSchema.assembly.capabilities).not.toContain("timeline.keyframes");
  });

  it("keeps history and zoom in the toolbar", () => {
    expect(appSchema.toolbar).toMatchObject({ history: true, radar: false, zoom: true });
  });

  it("covers the export resolution workload in the performance matrix", () => {
    expect(appPerformance.workloadTargets).toEqual(["export.image.resolution"]);
    expect(appPerformance.usesCustomRenderer).toBe(true);
  });
});
