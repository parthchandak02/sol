import type {
  ToolcraftAppComposition,
  ToolcraftPanelActionHandler,
} from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { EXPORT_PNG_ACTION } from "../sol/sun-export-actions";
import { downloadSunPathImage } from "../sol/sun-export";
import { SunPathCanvas } from "../sol/sun-path-canvas";
import { CITY_PRESETS, SOL_TARGETS } from "../sol/sun-path-settings";

export const handlePanelAction: ToolcraftPanelActionHandler = ({ action, dispatch, reportProgress, state }) => {
  if (action.value === EXPORT_PNG_ACTION) {
    return downloadSunPathImage(state, reportProgress);
  }

  const city = CITY_PRESETS.find((preset) => preset.value === action.value);
  if (city) {
    dispatch({ label: city.label, target: SOL_TARGETS.latitude, type: "controls.setValue", value: city.latitude });
    dispatch({ label: city.label, target: SOL_TARGETS.longitude, type: "controls.setValue", value: city.longitude });
  }
};

export const appComposition: ToolcraftAppComposition = {
  canvasContent: <SunPathCanvas />,
  onPanelAction: handlePanelAction,
  renderDefaultCanvasMedia: false,
  schema: appSchema,
};
