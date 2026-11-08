import type { ToolcraftCommand } from "@/toolcraft/runtime";

import { dayOfYearOf, utcOffsetMinutes } from "./solar";
import { CITY_PRESETS, NOW_ACTION, SEASON_PRESETS, SOL_TARGETS, readSolSettings } from "./sol-settings";

type ActionContext = {
  action: { label?: string; value: string };
  dispatch: (command: ToolcraftCommand) => void;
  state: { values: Readonly<Record<string, unknown>> };
};

/** Handles the Place, Season and Now shortcuts; `nowMs` is injectable for tests. */
export function handleSolAction({ action, dispatch, state }: ActionContext, nowMs = Date.now()): void {
  const city = CITY_PRESETS.find((preset) => preset.value === action.value);
  if (city) {
    dispatch({ label: city.label, target: SOL_TARGETS.latitude, type: "controls.setValue", value: city.latitude });
    dispatch({ label: city.label, target: SOL_TARGETS.longitude, type: "controls.setValue", value: city.longitude });
    return;
  }
  const season = SEASON_PRESETS.find((preset) => preset.value === action.value);
  if (season) {
    dispatch({ label: season.label, target: SOL_TARGETS.dayOfYear, type: "controls.setValue", value: season.dayOfYear });
    return;
  }
  if (action.value === NOW_ACTION) {
    const settings = readSolSettings(state.values);
    const offset = utcOffsetMinutes(settings, nowMs);
    const local = new Date(nowMs + offset * 60_000);
    const hours = Math.round((local.getUTCHours() + local.getUTCMinutes() / 60) * 4) / 4;
    dispatch({ label: "Now", target: SOL_TARGETS.dayOfYear, type: "controls.setValue", value: dayOfYearOf(nowMs, offset) });
    dispatch({ label: "Now", target: SOL_TARGETS.time, type: "controls.setValue", value: Math.min(24, hours) });
  }
}
