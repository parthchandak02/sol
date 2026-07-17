import { defineToolcraft } from "@/toolcraft/runtime";

const TODAY = new Date();
const startOfYear = new Date(TODAY.getFullYear(), 0, 0);
const diff = TODAY.getTime() - startOfYear.getTime();
const oneDay = 1000 * 60 * 60 * 24;
const defaultDay = Math.floor(diff / oneDay);

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
            presetNYC: {
              type: "action",
              target: "presetNYC",
              label: "New York",
              actions: [{ value: "presetNYC", variant: "outline" }],
            },
            presetLondon: {
              type: "action",
              target: "presetLondon",
              label: "London",
              actions: [{ value: "presetLondon", variant: "outline" }],
            },
            presetTokyo: {
              type: "action",
              target: "presetTokyo",
              label: "Tokyo",
              actions: [{ value: "presetTokyo", variant: "outline" }],
            },
            presetSydney: {
              type: "action",
              target: "presetSydney",
              label: "Sydney",
              actions: [{ value: "presetSydney", variant: "outline" }],
            },
            presetSingapore: {
              type: "action",
              target: "presetSingapore",
              label: "Singapore",
              actions: [{ value: "presetSingapore", variant: "outline" }],
            },
            presetReykjavik: {
              type: "action",
              target: "presetReykjavik",
              label: "Reykjavik",
              actions: [{ value: "presetReykjavik", variant: "outline" }],
            },
            presetCapeTown: {
              type: "action",
              target: "presetCapeTown",
              label: "Cape Town",
              actions: [{ value: "presetCapeTown", variant: "outline" }],
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
