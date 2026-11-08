import { openSol } from "./sol-test-helpers";
import { expect, test } from "./toolcraft-product-test";

test("browser: sol opens in the Toolcraft shell", async ({ page }) => {
  await openSol(page);
  await expect(page.getByRole("button", { exact: true, name: "Export PNG" })).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Now" })).toBeVisible();
  await expect(page.getByRole("application", { name: "Canvas viewport" })).toBeVisible();
});
