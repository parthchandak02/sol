import type { ToolcraftProductExportRenderer } from "@/toolcraft/runtime";

import { computeSolScene, drawSol } from "./sol-draw";
import { exportPass } from "./sol-pipeline";
import { readSolSettings } from "./sol-settings";

export const solExport: ToolcraftProductExportRenderer = {
  baseFileName: "sol",
  async renderFrame({ context, frame, rendererPipeline, signal, state }) {
    const render = () => {
      signal.throwIfAborted();
      const settings = readSolSettings(state.values);
      context.save();
      context.translate(frame.x, frame.y);
      drawSol(context, frame.width, frame.height, settings, computeSolScene(settings));
      context.restore();
      signal.throwIfAborted();
    };
    if (rendererPipeline) await rendererPipeline.runPass(exportPass, undefined, render);
    else render();
  },
};
