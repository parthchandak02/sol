import { defineToolcraft } from "@/toolcraft/runtime";

import { EXPORT_PNG_ACTION } from "../sol/sun-export-actions";
import { CITY_PRESETS, SOL_DEFAULTS, SOL_TARGETS } from "../sol/sun-path-settings";

export { CITY_PRESETS } from "../sol/sun-path-settings";

export const appSchema = defineToolcraft({
  canvas: {
    draggable: false,
    enabled: true,
    renderScale: true,
    size: { height: 1080, unit: "px", width: 1920 },
    sizing: { mode: "editable-output" },
    upload: false,
  },
  panels: {
    controls: {
      sections: [
        {
          controls: {
            latitude: {
              defaultValue: SOL_DEFAULTS.latitude,
              description: "North is positive. Sets how high the sun climbs and how long the day lasts.",
              label: "Latitude",
              max: 90,
              min: -90,
              orderRole: "primary",
              performanceReason: "Moves the arc and refetches times for the new place; drawing is a cheap Canvas 2D pass.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: 0.1,
              target: SOL_TARGETS.latitude,
              type: "slider",
              unit: "°",
            },
            longitude: {
              defaultValue: SOL_DEFAULTS.longitude,
              description: "East is positive. Shifts the clock times of sunrise, noon, and sunset.",
              label: "Longitude",
              max: 180,
              min: -180,
              orderRole: "primary",
              performanceReason: "Refetches clock times for the new place; the arc shape does not change.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: 0.1,
              target: SOL_TARGETS.longitude,
              type: "slider",
              unit: "°",
            },
            cityPreset: {
              actions: CITY_PRESETS.map((city) => ({
                label: city.label,
                value: city.value,
                variant: "outline" as const,
              })),
              description: "Sets latitude and longitude to the city.",
              label: "Cities",
              orderRole: "action",
              performanceReason: "Sets two sliders at once; one redraw of a cheap Canvas 2D scene.",
              performanceRole: "responsiveness",
              target: SOL_TARGETS.cityPreset,
              type: "actions",
            },
          },
          title: "Location",
        },
        {
          controls: {
            dayOfYear: {
              defaultValue: SOL_DEFAULTS.dayOfYear,
              description: "1 is 1 January, 172 is around the June solstice, 355 is around the December solstice.",
              label: "Day of year",
              max: 365,
              min: 1,
              orderRole: "primary",
              performanceReason: "Changes the arc height and daytime share and refetches times; drawing is a cheap Canvas 2D pass.",
              performanceRole: "responsiveness",
              sliderValueKind: "continuous",
              step: 1,
              target: SOL_TARGETS.dayOfYear,
              type: "slider",
            },
          },
          title: "Date",
        },
        {
          controls: {
            includeBackground: {
              defaultValue: SOL_DEFAULTS.includeBackground,
              label: "Include",
              performanceReason: "Toggles one gradient fill in the sky pass.",
              performanceRole: "responsiveness",
              target: SOL_TARGETS.includeBackground,
              type: "switch",
            },
            skyBackground: {
              defaultValue: SOL_DEFAULTS.background,
              label: false,
              performanceReason: "Recolours one gradient fill in the sky pass.",
              performanceRole: "responsiveness",
              target: SOL_TARGETS.background,
              type: "color",
            },
          },
          layoutGroups: [
            { columns: 2, controls: ["includeBackground", "skyBackground"], layout: "inline" },
          ],
          title: "Background",
        },
        {
          controls: {
            imageFormat: {
              defaultValue: SOL_DEFAULTS.imageFormat,
              label: "Format",
              options: [
                { label: "PNG", value: "png" },
                { label: "JPG", value: "jpg" },
              ],
              performanceReason: "Only changes the encoder used when exporting.",
              performanceRole: "responsiveness",
              target: SOL_TARGETS.imageFormat,
              type: "select",
            },
            imageResolution: {
              defaultValue: SOL_DEFAULTS.imageResolution,
              label: "Resolution",
              options: [
                { label: "2K", value: "2k" },
                { label: "4K", value: "4k" },
                { label: "8K", value: "8k" },
              ],
              performanceReason: "Sets exported pixel size; larger exports take longer to render and encode.",
              performanceRole: "workload",
              target: SOL_TARGETS.imageResolution,
              type: "select",
            },
          },
          layoutGroups: [{ columns: 2, controls: ["imageFormat", "imageResolution"], layout: "inline" }],
          title: "Image Export",
        },
        {
          actionGroup: "primary",
          controls: {
            exportActions: {
              actions: [
                {
                  icon: "upload-simple",
                  label: "Export PNG",
                  role: "export-image",
                  value: EXPORT_PNG_ACTION,
                },
              ],
              label: false,
              target: "export.actions",
              type: "panelActions",
            },
          },
          title: "Export",
        },
      ],
      title: "Sol",
    },
    layers: false,
  },
  persistence: { storage: "none" },
  toolbar: {
    history: true,
    radar: false,
    zoom: true,
  },
});
