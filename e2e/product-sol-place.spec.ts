import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { holdSliderDrag, openSol, outputSelector, reveal, waitForFrame } from "./sol-test-helpers";
import { expect, test } from "./toolcraft-product-test";
import { CITY_PRESETS, SEASON_PRESETS, SOL_TARGETS } from "../src/sol/sol-settings";

const sliders = [
  [SOL_TARGETS.latitude, 0.9],
  [SOL_TARGETS.longitude, 0.85],
] as const;

for (const [target, ratio] of sliders) {
  test(`browser: sol control ${target}`, async ({ page }) => {
    const session = await openSol(page);
    const field = await getToolcraftControlFieldByTarget(page, target);
    const before = await field.getByRole("slider").getAttribute("aria-valuenow");
    // The poster must change while the pointer is still held down
    await expectToolcraftProductObservableToChange(session, session.controlAction(target, () => holdSliderDrag(page, target, ratio)), {
      requirementId: target,
      selector: outputSelector,
    });
    await page.mouse.up();
    await waitForFrame(page);
    await expectToolcraftReferenceParity(async () => (await field.getByRole("slider").getAttribute("aria-valuenow")) !== before, true, { requirementId: target, target });
  });
}

test(`browser: sol control ${SOL_TARGETS.cityPreset}`, async ({ page }) => {
  const session = await openSol(page);
  const order = [...CITY_PRESETS.filter((city) => city.label !== "New York"), CITY_PRESETS[0]];
  for (const city of order) {
    await expectToolcraftProductObservableToChange(
      session,
      session.controlAction(SOL_TARGETS.cityPreset, async (field) => {
        await reveal(field);
        await field.getByRole("button", { exact: true, name: city.label }).click();
      }),
      { requirementId: SOL_TARGETS.cityPreset, selector: outputSelector },
    );
    const latitude = await getToolcraftControlFieldByTarget(page, SOL_TARGETS.latitude);
    await expect(latitude.getByRole("slider")).toHaveAttribute("aria-valuenow", String(city.latitude));
  }
  await expectToolcraftReferenceParity(
    async () => (await getToolcraftControlFieldByTarget(page, SOL_TARGETS.longitude)).getByRole("slider").getAttribute("aria-valuenow"),
    String(CITY_PRESETS[0].longitude),
    { requirementId: SOL_TARGETS.cityPreset, target: SOL_TARGETS.cityPreset },
  );
});

