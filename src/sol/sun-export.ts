// PNG/JPG export for Sol: renders the same scene as the preview at the selected Image Export
// resolution through the standard Toolcraft PNG export helper.

import { createToolcraftPngExportCanvas, type ToolcraftState } from "@/toolcraft/runtime";

import { drawSunPath } from "./sun-path-draw";
import { readSunPathSettings } from "./sun-path-settings";
import { loadSunTimes, type SunTimes } from "./sun-model";

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image export produced no data."))),
      mimeType,
      0.95,
    );
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Draw the export canvas for the current settings (separate from encoding so it can be tested). */
export function renderSunPathExportCanvas(
  state: ToolcraftState,
  times: SunTimes,
  nowMs: number,
  canvasFactory?: () => HTMLCanvasElement,
): HTMLCanvasElement {
  const settings = readSunPathSettings(state.values);
  return createToolcraftPngExportCanvas({
    ...(canvasFactory ? { canvasFactory } : {}),
    includeBackground: settings.includeBackground,
    render: ({ context, cssHeight, cssWidth }) => {
      drawSunPath(context, {
        background: settings.background,
        dayOfYear: settings.dayOfYear,
        height: cssHeight,
        includeBackground: settings.includeBackground,
        latitude: settings.latitude,
        nowMs,
        times,
        width: cssWidth,
      });
    },
    resolution: settings.imageResolution,
    state,
  });
}

export function exportMimeType(state: ToolcraftState): "image/jpeg" | "image/png" {
  return readSunPathSettings(state.values).imageFormat === "jpg" ? "image/jpeg" : "image/png";
}

export async function exportSunPathImage(
  state: ToolcraftState,
  reportProgress: (progress: number) => void = () => {},
): Promise<Blob> {
  const settings = readSunPathSettings(state.values);
  reportProgress(0.1);
  const times = await loadSunTimes(settings, new Date().getFullYear());
  reportProgress(0.4);
  const canvas = renderSunPathExportCanvas(state, times, Date.now());
  reportProgress(0.7);
  const blob = await canvasToBlob(canvas, exportMimeType(state));
  reportProgress(1);
  return blob;
}

export async function downloadSunPathImage(
  state: ToolcraftState,
  reportProgress: (progress: number) => void,
): Promise<void> {
  const blob = await exportSunPathImage(state, reportProgress);
  const extension = exportMimeType(state) === "image/jpeg" ? "jpg" : "png";
  downloadBlob(blob, `sol-sun-path.${extension}`);
}
