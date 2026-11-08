import { getToolcraftFiniteArtboardRect } from "@/toolcraft/runtime";
import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { handleSolAction } from "../sol/sol-actions";
import { SolCanvas } from "../sol/SolCanvas";
import { solExport } from "../sol/sol-export";
import { solPipeline } from "../sol/sol-pipeline";
import { appSchema } from "./app-schema";

export const appComposition = composeToolcraftApp(appSchema, {
  actions: { onPanelAction: handleSolAction },
  renderer: { pipelineRegistration: solPipeline },
  scene: {
    canvasContent: <SolCanvas />,
    rasterFrameRenderer: solExport,
    renderDefaultCanvasMedia: false,
    sceneBoundsProvider: ({ state }) => [getToolcraftFiniteArtboardRect(state.canvas.size)],
  },
});
