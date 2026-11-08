import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftBackgroundOutputSemantics } from "./browser-background-output-evidence";
import { expectToolcraftInfinityCanvasBackgroundEvidence, observeInfinityCanvasBackground } from "./browser-infinity-canvas-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";
import { downloadImage, fieldValue, openSol, outputSelector, selectValue } from "./sol-test-helpers";
import { expect, test } from "./toolcraft-product-test";

test("browser: sol background color changes output", async ({ page }) => {
  const session = await openSol(page);
  // A dark background flips the ink, so the poster itself changes too
  await expectToolcraftProductObservableToChange(session, session.controlAction("appearance.background", () => fieldValue(page, "appearance.background", "#14182B")), {
    requirementId: "appearance.background",
    selector: outputSelector,
  });
  await expectToolcraftReferenceParity(() => page.getByRole("textbox", { name: "Background color hex" }).inputValue(), "#14182B", {
    requirementId: "appearance.background",
    target: "appearance.background",
  });
});
