import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { holdSliderDrag, openSol, outputSelector, reveal, waitForFrame } from "./sol-test-helpers";
import { expect, test } from "./toolcraft-product-test";
import { CITY_PRESETS, SEASON_PRESETS, SOL_TARGETS } from "../src/sol/sol-settings";

const sliders = [
  [SOL_TARGETS.dayOfYear, 0.95],
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

test(`browser: sol control ${SOL_TARGETS.season}`, async ({ page }) => {
  const session = await openSol(page);
  // Default is the June solstice, so start with another season and finish on June
  const order = [...SEASON_PRESETS.filter((season) => season.value !== "season-june"), SEASON_PRESETS[1]];
  for (const season of order) {
    await expectToolcraftProductObservableToChange(
      session,
      session.controlAction(SOL_TARGETS.season, async (field) => {
        await reveal(field);
        await field.getByRole("button", { exact: true, name: season.label }).click();
      }),
      { requirementId: SOL_TARGETS.season, selector: outputSelector },
    );
    const day = await getToolcraftControlFieldByTarget(page, SOL_TARGETS.dayOfYear);
    await expect(day.getByRole("slider")).toHaveAttribute("aria-valuenow", String(season.dayOfYear));
  }
  await expectToolcraftReferenceParity(async () => true, true, { requirementId: SOL_TARGETS.season, target: SOL_TARGETS.season });
});

