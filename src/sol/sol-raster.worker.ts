/// <reference lib="webworker" />
import { computeSolScene, drawSol, type SolScene } from "./sol-draw";
import type { SolRasterRequest, SolRasterResponse } from "./sol-raster-protocol";

declare const self: DedicatedWorkerGlobalScope;
const canvas = new OffscreenCanvas(1, 1);
let cachedKey = "";
let scene: SolScene | null = null;

self.onmessage = (event: MessageEvent<SolRasterRequest>) => {
  const { backingHeight, backingWidth, height, id, settings, width } = event.data;
  try {
    // Astronomy depends only on place, day and time; resizing or zooming reuses it
    const key = JSON.stringify([settings.latitude, settings.longitude, settings.dayOfYear, settings.time]);
    if (!scene || key !== cachedKey) {
      scene = computeSolScene(settings);
      cachedKey = key;
    }
    canvas.width = backingWidth;
    canvas.height = backingHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    context.setTransform(backingWidth / width, 0, 0, backingHeight / height, 0, 0);
    drawSol(context, width, height, settings, scene);
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage({ bitmap, id } satisfies SolRasterResponse, [bitmap]);
  } catch (error) {
    self.postMessage({ error: String(error), id } satisfies SolRasterResponse);
  }
};
