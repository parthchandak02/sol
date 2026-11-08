import { expect, test } from "@playwright/test";

import { CITY_PRESETS, SOL_TARGETS } from "../src/sol/sun-path-settings";
import { expectToolcraftExportedArtifact } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftBackgroundOutputSemantics } from "./browser-conditional-output-evidence-helpers";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { dragToolcraftSliderTargetToValue } from "./performance-slider-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import {
  chooseSelectOption,
  clickExportPng,
  decodeImage,
  openSol,
  revealControl,
  SUN_PATH_SELECTOR,
  waitForSunTimes,
} from "./sol-test-helpers";

const observeSunPath = { selector: SUN_PATH_SELECTOR };

async function sliderValue(page: import("@playwright/test").Page, target: string): Promise<number> {
  const field = await getToolcraftControlFieldByTarget(page, target);
  return Number(await field.getByRole("slider").first().getAttribute("aria-valuenow"));
}

test.beforeEach(async ({ page }) => {
  await openSol(page);
});

test("browser: latitude slider reshapes the sun arc while dragging", async ({ page }) => {
  const session = await createToolcraftBrowserProofSession(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction(SOL_TARGETS.latitude, async (control, page) => {
      await revealControl(control);
      await dragToolcraftSliderTargetToValue(page, SOL_TARGETS.latitude, 75);
      await waitForSunTimes(page);
    }),
    { ...observeSunPath, requirementId: "location-latitude" },
  );
  expect(await sliderValue(page, SOL_TARGETS.latitude)).toBeGreaterThan(60);
});

test("browser: longitude slider changes the clock times on the canvas", async ({ page }) => {
  const session = await createToolcraftBrowserProofSession(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction(SOL_TARGETS.longitude, async (control, page) => {
      await revealControl(control);
      await dragToolcraftSliderTargetToValue(page, SOL_TARGETS.longitude, 139);
      await waitForSunTimes(page);
    }),
    { ...observeSunPath, requirementId: "location-longitude" },
  );
  expect(await sliderValue(page, SOL_TARGETS.longitude)).toBeGreaterThan(100);
});

test("browser: each city button moves the location sliders and redraws the arc", async ({ page }) => {
  const session = await createToolcraftBrowserProofSession(page);
  // Start away from New York so every button, including New York, moves the sliders
  const order = [...CITY_PRESETS.filter((city) => city.label !== "New York"), CITY_PRESETS[0]];

  for (const city of order) {
    await expectToolcraftProductObservableToChange(
      session,
      session.controlAction(SOL_TARGETS.cityPreset, async (control, page) => {
        await revealControl(control);
        await control.getByRole("button", { exact: true, name: city.label }).click();
        await waitForSunTimes(page);
      }),
      { ...observeSunPath, requirementId: "location-city-preset" },
    );
    expect(await sliderValue(page, SOL_TARGETS.latitude)).toBeCloseTo(city.latitude, 1);
    expect(await sliderValue(page, SOL_TARGETS.longitude)).toBeCloseTo(city.longitude, 1);
  }
});

test("browser: day of year slider moves the arc with the season while dragging", async ({ page }) => {
  const session = await createToolcraftBrowserProofSession(page);
  const start = await sliderValue(page, SOL_TARGETS.dayOfYear);
  const destination = Math.abs(start - 172) > 30 ? 172 : 355;
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction(SOL_TARGETS.dayOfYear, async (control, page) => {
      await revealControl(control);
      await dragToolcraftSliderTargetToValue(page, SOL_TARGETS.dayOfYear, destination);
      await waitForSunTimes(page);
    }),
    { ...observeSunPath, requirementId: "date-day-of-year" },
  );
  expect(Math.abs((await sliderValue(page, SOL_TARGETS.dayOfYear)) - destination)).toBeLessThan(5);
});

test("browser: background include switch hides the sky in preview and PNG", async ({ page }) => {
  const session = await createToolcraftBrowserProofSession(page);
  const observePreview = session.observe((root) => {
    const canvas = root.querySelector<HTMLCanvasElement>("[data-sol-sun-path]");
    const context = canvas?.getContext("2d");
    const alpha = canvas && context ? context.getImageData(canvas.width - 2, 2, 1, 1).data[3] : -1;
    return { backgroundVisible: alpha === 255, outputSignature: alpha === 255 ? "sky" : `corner-alpha-${alpha}` };
  });

  await expectToolcraftBackgroundOutputSemantics(
    observePreview,
    session.controlAction(SOL_TARGETS.includeBackground, async (control) => {
      await revealControl(control);
      await control.getByRole("switch").click();
    }),
    { backgroundVisible: false, outputSignature: "corner-alpha-0" },
    session.controlAction("export.actions", (_control, page) => clickExportPng(page)),
    async (file) => {
      const image = await decodeImage(page, file);
      return { ...image, backgroundAlpha: image.cornerAlpha };
    },
    { requirementId: "export-include-background" },
  );
});

test("browser: sky colour changes the canvas background", async ({ page }) => {
  const session = await createToolcraftBrowserProofSession(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction(SOL_TARGETS.background, async (control) => {
      await revealControl(control);
      const input = control.locator('input[aria-label="skyBackground hex"]');
      await input.fill("#F4C27A");
      await input.press("Enter");
    }),
    { ...observeSunPath, requirementId: "sky-background" },
  );
});

test("browser: image format switches the exported file type", async ({ page }) => {
  const session = await createToolcraftBrowserProofSession(page);
  const types: string[] = [];
  for (const [label, mediaType] of [["JPG", "image/jpeg"], ["PNG", "image/png"]] as const) {
    await expectToolcraftExportedArtifact(
      session.controlAction(SOL_TARGETS.imageFormat, async (control, page) => {
        await revealControl(control);
        await chooseSelectOption(page, control, label);
        return clickExportPng(page);
      }),
      async (file) => {
        const image = await decodeImage(page, file);
        expect(image.mediaType).toBe(mediaType);
        types.push(image.mediaType);
        return { byteLength: image.byteLength, contentHash: image.contentHash, height: image.height, mediaType: image.mediaType, width: image.width };
      },
      { requirementId: "export-image-format" },
    );
  }
  expect(types).toEqual(["image/jpeg", "image/png"]);
});

test("browser: image resolution changes the exported pixel size", async ({ page }) => {
  const session = await createToolcraftBrowserProofSession(page);
  const widths: number[] = [];
  for (const [label, width] of [["2K", 2048], ["8K", 8192], ["4K", 4096]] as const) {
    await expectToolcraftExportedArtifact(
      session.controlAction(SOL_TARGETS.imageResolution, async (control, page) => {
        await revealControl(control);
        await chooseSelectOption(page, control, label);
        return clickExportPng(page);
      }),
      async (file) => {
        const image = await decodeImage(page, file);
        expect(image.width).toBe(width);
        widths.push(image.width);
        return { byteLength: image.byteLength, contentHash: image.contentHash, height: image.height, mediaType: image.mediaType, width: image.width };
      },
      { requirementId: "export-image-resolution" },
    );
  }
  expect(widths).toEqual([2048, 8192, 4096]);
});

test("browser: Export PNG downloads the current sun path", async ({ page }) => {
  const session = await createToolcraftBrowserProofSession(page);
  await expectToolcraftExportedArtifact(
    session.controlAction("export.actions", (_control, page) => clickExportPng(page)),
    async (file) => {
      expect(file.fileName).toBe("sol-sun-path.png");
      const image = await decodeImage(page, file);
      expect(image.mediaType).toBe("image/png");
      expect([image.width, image.height]).toEqual([4096, 2304]);
      expect(image.cornerAlpha).toBe(255);
      return { byteLength: image.byteLength, contentHash: image.contentHash, height: image.height, mediaType: image.mediaType, width: image.width };
    },
    { requirementId: "export-png-action" },
  );
});
