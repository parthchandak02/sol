import { expectToolcraftReferenceParity } from "./browser-acceptance-outcome-helpers";
import { expectToolcraftInfinityCanvasImageExportEvidence } from "./browser-infinity-canvas-evidence";
import { expectToolcraftImageExportArtifact } from "./browser-media-export-evidence";
import { inspectToolcraftImageDownload } from "./image-artifact-inspection";
import { downloadImage, openSol, selectValue } from "./sol-test-helpers";
import { test } from "./toolcraft-product-test";
import { computeSolScene, sunCentreRatio } from "../src/sol/sol-draw";
import { readSolSettings } from "../src/sol/sol-settings";

const backgroundRgba = [243, 238, 228, 255] as const;
const gold = [212, 137, 42, 255] as const;
const defaults = readSolSettings({});
const sun = sunCentreRatio(defaults, computeSolScene(defaults));

// Default poster: New York, 21 June, 17:00. Bounds measured from a real export of this state.
const posterArtifact = {
  backgroundRgba,
  expectedBounds: { height: 0.828125, width: 0.90625, x: 0.046875, y: 0.09375 },
  expectedPixels: [
    { rgba: gold, xRatio: sun.xRatio, yRatio: sun.yRatio },
    { rgba: backgroundRgba, xRatio: 0.02, yRatio: 0.02 },
  ],
};

test("browser: sol image export delivers every format and size", async ({ page }) => {
  const session = await openSol(page);
  for (const [format, mediaType] of [["PNG", "image/png"], ["JPG", "image/jpeg"]] as const) {
    await selectValue(page, "export.image.format", format);
    for (const [resolution, width] of [["2K", 2048], ["4K", 4096], ["8K", 8192]] as const) {
      await selectValue(page, "export.image.resolution", resolution);
      await expectToolcraftImageExportArtifact(session.targetAction("actions.output", () => downloadImage(page)), {
        ...posterArtifact,
        additionalArtifactRequirements: [
          { requirementId: "export.image.format", target: "export.image.format" },
          { requirementId: "export.image.resolution", target: "export.image.resolution" },
        ],
        expectedHeight: (width * 9) / 16,
        expectedMediaType: mediaType,
        expectedWidth: width,
        page,
        requirementId: "export.image",
      });
    }
  }
  await selectValue(page, "export.image.format", "PNG");
  await selectValue(page, "export.image.resolution", "2K");
  await page.getByRole("switch", { exact: true, name: "Infinity canvas" }).uncheck();
  const finite = (await inspectToolcraftImageDownload({ backgroundRgba, download: await downloadImage(page), page })).inspection;
  await page.getByRole("switch", { exact: true, name: "Infinity canvas" }).check();
  const infinite = (await inspectToolcraftImageDownload({ backgroundRgba, download: await downloadImage(page), page })).inspection;
  await expectToolcraftInfinityCanvasImageExportEvidence({ finite, infinite }, { expectedSize: { height: 1152, width: 2048 }, requirementId: "export.infinity", target: "actions.output" });
  await expectToolcraftReferenceParity(async () => [infinite.width / infinite.height, infinite.decodedPixelHash === finite.decodedPixelHash], [16 / 9, true], {
    requirementId: "export.infinity",
    target: "actions.output",
  });
});
