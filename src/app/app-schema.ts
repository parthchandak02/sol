import { defineToolcraft } from "@/toolcraft/runtime";

const TODAY = new Date();
const startOfYear = new Date(TODAY.getFullYear(), 0, 0);
const diff = TODAY.getTime() - startOfYear.getTime();
const oneDay = 1000 * 60 * 60 * 24;
const defaultDay = Math.floor(diff / oneDay);

export const CITY_PRESETS = [
  { value: "presetNYC", label: "New York", latitude: 40.7, longitude: -74.0 },
  { value: "presetLondon", label: "London", latitude: 51.5, longitude: -0.1 },
  { value: "presetTokyo", label: "Tokyo", latitude: 35.7, longitude: 139.7 },
  { value: "presetSydney", label: "Sydney", latitude: -33.9, longitude: 151.2 },
  { value: "presetSingapore", label: "Singapore", latitude: 1.3, longitude: 103.8 },
  { value: "presetReykjavik", label: "Reykjavik", latitude: 64.1, longitude: -21.9 },
  { value: "presetCapeTown", label: "Cape Town", latitude: -33.9, longitude: 18.4 },
] as const;

export const appSchema = defineToolcraft({
  canvas: {
    enabled: true,
    draggable: false,
    upload: false,
    sizing: { mode: "editable-output" },
  },
  panels: {
    controls: {
      title: "Controls",
      sections: [
        {
          title: "Location",
          controls: {
            latitude: {
              type: "slider",
              target: "latitude",
              label: "Latitude",
              defaultValue: 40.7,
              min: -90,
              max: 90,
              step: 0.1,
              valueLabel: "deg",
            },
            longitude: {
              type: "slider",
              target: "longitude",
              label: "Longitude",
              defaultValue: -74.0,
              min: -180,
              max: 180,
              step: 0.1,
              valueLabel: "deg",
            },
          },
        },
        {
          title: "Date",
          controls: {
            dayOfYear: {
              type: "slider",
              target: "dayOfYear",
              label: "Day of Year",
              defaultValue: defaultDay,
              min: 1,
              max: 365,
              step: 1,
              valueLabel: "day",
            },
          },
        },
        {
          title: "Presets",
          controls: {
            cityPreset: {
              type: "actions",
              target: "cityPreset",
              label: "City",
              description: "Jump the latitude and longitude sliders to a city.",
              actions: CITY_PRESETS.map((city) => ({
                label: city.label,
                value: city.value,
                variant: "outline" as const,
              })),
            },
          },
        },
      ],
    },
    layers: false,
    timeline: false,
  },
  toolbar: {
    history: false,
    radar: false,
    zoom: false,
  },
  persistence: { storage: "none" },
});
