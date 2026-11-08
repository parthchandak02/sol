// Browser performance scenarios for Sol. Every test name matches a scenario in
// src/app/app-performance.ts, and budgets come from that file only.

import { test, type Page } from "@playwright/test";

import { appPerformance } from "../src/app/app-performance";
import { SOL_TARGETS } from "../src/sol/sun-path-settings";
import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { expectToolcraftScenarioPerformanceBudget } from "./performance-budget-helpers";
import {
  expectToolcraftCanvasViewportStable,
  zoomToolcraftCanvasViewport,
} from "./performance-canvas-helpers";
import {
  applyToolcraftPerformanceStressFixture,
  applyToolcraftPerformanceStressValue,
} from "./performance-fixture-helpers";
import { measureToolcraftDownloadActionByLabel } from "./performance-output-action-helpers";
import { measureToolcraftInteraction } from "./performance-probe-helpers";
import { expectToolcraftCanvasBackingPixelsForRenderScale } from "./performance-render-scale-helpers";
import {
  dragToolcraftSliderTargetToValue,
  dragToolcraftSliderToPerformanceStressValue,
} from "./performance-slider-helpers";
import { getToolcraftProductObservableSnapshot } from "./product-observable-helpers";
import { chooseSelectOption, openSol, revealTarget, SUN_PATH_SELECTOR } from "./sol-test-helpers";

const observeSunPath = (page: Page) => () => getToolcraftProductObservableSnapshot(page, { selector: SUN_PATH_SELECTOR });

function scenario(id: string) {
  const found = appPerformance.scenarios.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown performance scenario ${id}`);
  return found;
}

async function sliderDragScenario(page: Page, id: string): Promise<void> {
  const { controlLabel, target } = scenario(id);
  await openSol(page);
  await revealTarget(page, target!);
  const result = await measureToolcraftInteraction(
    page,
    () => dragToolcraftSliderToPerformanceStressValue(page, controlLabel!, appPerformance, id),
    { observeOutcome: observeSunPath(page), scenarioId: id, target },
  );
  await expectToolcraftScenarioPerformanceBudget(result, appPerformance, id);
}

async function selectValue(page: Page, target: string): Promise<string> {
  const field = await getToolcraftControlFieldByTarget(page, target);
  return field.locator("input").first().inputValue();
}

test.describe.configure({ mode: "serial" });

test("browser perf: latitude drag keeps the arc live", async ({ page }) => {
  await sliderDragScenario(page, "latitude-drag");
});

test("browser perf: longitude drag keeps the canvas live", async ({ page }) => {
  await sliderDragScenario(page, "longitude-drag");
});

test("browser perf: day of year drag keeps the arc live", async ({ page }) => {
  await sliderDragScenario(page, "day-of-year-drag");
});

test("browser perf: city button redraws promptly", async ({ page }) => {
  const id = "city-preset-change";
  const { target } = scenario(id);
  await openSol(page);
  await revealTarget(page, target!);
  const field = await getToolcraftControlFieldByTarget(page, target!);
  const result = await measureToolcraftInteraction(
    page,
    () => field.getByRole("button", { exact: true, name: "Reykjavik" }).click(),
    { observeOutcome: observeSunPath(page), scenarioId: id, target },
  );
  await expectToolcraftScenarioPerformanceBudget(result, appPerformance, id);
});

test("browser perf: background include toggles promptly", async ({ page }) => {
  const id = "include-background-change";
  const { target } = scenario(id);
  await openSol(page);
  await revealTarget(page, target!);
  const field = await getToolcraftControlFieldByTarget(page, target!);
  const result = await measureToolcraftInteraction(page, () => field.getByRole("switch").click(), {
    observeOutcome: observeSunPath(page),
    scenarioId: id,
    target,
  });
  await expectToolcraftScenarioPerformanceBudget(result, appPerformance, id);
});

test("browser perf: sky colour change redraws promptly", async ({ page }) => {
  const id = "sky-background-change";
  const { target, uiSelector } = scenario(id);
  await openSol(page);
  await revealTarget(page, target!);
  const input = page.locator(uiSelector!);
  await input.fill("#F4C27A");
  const result = await measureToolcraftInteraction(page, () => input.press("Enter"), {
    observeOutcome: observeSunPath(page),
    scenarioId: id,
    target,
  });
  await expectToolcraftScenarioPerformanceBudget(result, appPerformance, id);
});

test("browser perf: image format change stays responsive", async ({ page }) => {
  const id = "image-format-change";
  const { target } = scenario(id);
  await openSol(page);
  await revealTarget(page, target!);
  const field = await getToolcraftControlFieldByTarget(page, target!);
  const result = await measureToolcraftInteraction(page, () => chooseSelectOption(page, field, "JPG"), {
    expectedOutcome: "jpg",
    observeOutcome: () => selectValue(page, target!),
    scenarioId: id,
    target,
  });
  await expectToolcraftScenarioPerformanceBudget(result, appPerformance, id);
});

test("browser perf: image resolution change stays responsive", async ({ page }) => {
  const id = "image-resolution-change";
  const { target } = scenario(id);
  await openSol(page);
  await revealTarget(page, target!);
  const field = await getToolcraftControlFieldByTarget(page, target!);
  const result = await measureToolcraftInteraction(
    page,
    () =>
      applyToolcraftPerformanceStressValue(appPerformance, id, {
        applyValue: (value) => chooseSelectOption(page, field, String(value).toUpperCase()),
        observeValue: () => selectValue(page, target!),
      }),
    { expectedOutcome: "8k", observeOutcome: () => selectValue(page, target!), scenarioId: id, target },
  );
  await expectToolcraftScenarioPerformanceBudget(result, appPerformance, id);
});

test("browser perf: Export PNG at 8K downloads within budget", async ({ page }) => {
  const id = "export-png";
  const { target } = scenario(id);
  await openSol(page);
  await revealTarget(page, SOL_TARGETS.imageResolution);
  const field = await getToolcraftControlFieldByTarget(page, SOL_TARGETS.imageResolution);
  await applyToolcraftPerformanceStressValue(appPerformance, id, {
    applyValue: (value) => chooseSelectOption(page, field, String(value).toUpperCase()),
    observeValue: () => selectValue(page, SOL_TARGETS.imageResolution),
  });
  const { result } = await measureToolcraftDownloadActionByLabel(page, "Export PNG", { scenarioId: id, target });
  await expectToolcraftScenarioPerformanceBudget(result, appPerformance, id);
});

test("browser perf: preview renders at Resolution scale 2", async ({ page }) => {
  const id = "preview-render";
  await openSol(page);
  await revealTarget(page, SOL_TARGETS.renderScale);
  // Start from scale 1 so applying the declared scale 2 is a real change in backing pixels
  await dragToolcraftSliderTargetToValue(page, SOL_TARGETS.renderScale, 1);
  const renderScaleSlider = async () =>
    Number(await (await getToolcraftControlFieldByTarget(page, SOL_TARGETS.renderScale)).getByRole("slider").first().getAttribute("aria-valuenow"));
  const result = await measureToolcraftInteraction(
    page,
    () =>
      applyToolcraftPerformanceStressFixture(page, appPerformance, id, {
        renderScale: {
          applyValue: (value) => dragToolcraftSliderTargetToValue(page, SOL_TARGETS.renderScale, Number(value)),
          observeValue: renderScaleSlider,
        },
      }),
    { observeOutcome: observeSunPath(page), scenarioId: id },
  );
  await expectToolcraftCanvasBackingPixelsForRenderScale(page, SUN_PATH_SELECTOR, 2, { scenarioId: id });
  await expectToolcraftScenarioPerformanceBudget(result, appPerformance, id);
});

test("browser perf: zoom keeps the frame stable", async ({ page }) => {
  const id = "viewport-stability";
  await openSol(page);
  const result = await expectToolcraftCanvasViewportStable(page, () => zoomToolcraftCanvasViewport(page, 2), {
    scenarioId: id,
  });
  await expectToolcraftScenarioPerformanceBudget(result, appPerformance, id);
});
