import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { holdSliderDrag, openSol, outputSelector, reveal, waitForFrame } from "./sol-test-helpers";
import { expect, test } from "./toolcraft-product-test";
import { CITY_PRESETS, SEASON_PRESETS, SOL_TARGETS } from "../src/sol/sol-settings";

const sliders = [
  [SOL_TARGETS.time, 0.35],
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

test(`browser: sol control ${SOL_TARGETS.moment}`, async ({ page }) => {
  // Freeze the browser clock at 2026-03-01 15:30 UTC (10:30 in New York) so Now is deterministic
  await page.clock.setFixedTime(new Date(Date.UTC(2026, 2, 1, 15, 30)));
  const session = await openSol(page);
  await expectToolcraftProductObservableToChange(
    session,
    session.controlAction(SOL_TARGETS.moment, async (field) => {
      await reveal(field);
      await field.getByRole("button", { exact: true, name: "Now" }).click();
    }),
    { requirementId: SOL_TARGETS.moment, selector: outputSelector },
  );
  const time = await getToolcraftControlFieldByTarget(page, SOL_TARGETS.time);
  await expect(time.getByRole("slider")).toHaveAttribute("aria-valuenow", "10.5");
  await expectToolcraftReferenceParity(
    async () => (await getToolcraftControlFieldByTarget(page, SOL_TARGETS.dayOfYear)).getByRole("slider").getAttribute("aria-valuenow"),
    "60",
    { requirementId: SOL_TARGETS.moment, target: SOL_TARGETS.moment },
  );
});
