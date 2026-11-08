// Product-owned browser helpers for Sol: a deterministic Sunrise-Sunset API stub, opening the
// app, capturing downloads, and decoding exported images in the browser.

import { readFile } from "node:fs/promises";

import { expect, type Locator, type Page } from "@playwright/test";

import { dayLengthHours } from "../src/sol/sun-model";

export const SUN_PATH_SELECTOR = "[data-sol-sun-path]";

/**
 * Answer api.sunrise-sunset.org from the sunrise equation, with solar noon at 12:00 local
 * solar time for the requested longitude, so tests never depend on the live service.
 */
export async function stubSunriseSunsetApi(page: Page): Promise<void> {
  await page.route("https://api.sunrise-sunset.org/**", async (route) => {
    const url = new URL(route.request().url());
    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lng"));
    const [year, month, day] = (url.searchParams.get("date") ?? "2026-06-21").split("-").map(Number);
    const startOfYear = Date.UTC(year, 0, 0);
    const dayOfYear = Math.round((Date.UTC(year, month - 1, day) - startOfYear) / 86_400_000);
    const hours = dayLengthHours(latitude, dayOfYear);
    const noonUtc = Date.UTC(year, month - 1, day, 12) - (longitude / 15) * 3_600_000;
    const half = (hours * 3_600_000) / 2;
    const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "+00:00");

    await route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      json: {
        results: {
          civil_twilight_begin: iso(noonUtc - half - 30 * 60_000),
          civil_twilight_end: iso(noonUtc + half + 30 * 60_000),
          day_length: Math.round(hours * 3600),
          solar_noon: iso(noonUtc),
          sunrise: iso(noonUtc - half),
          sunset: iso(noonUtc + half),
        },
        status: "OK",
      },
    });
  });
}

export async function waitForSunTimes(page: Page): Promise<void> {
  await expect(page.locator(SUN_PATH_SELECTOR)).toHaveAttribute("data-sol-times", /live|computed/, { timeout: 10_000 });
}

export async function openSol(page: Page): Promise<void> {
  await stubSunriseSunsetApi(page);
  await page.goto("/");
  await expect(page.locator('[data-slot="toolcraft-runtime-app"]')).toBeVisible();
  await waitForSunTimes(page);
}

export type DownloadedFile = { bytes: Buffer; fileName: string };

export async function downloadFrom(page: Page, click: () => Promise<void>): Promise<DownloadedFile> {
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), click()]);
  const path = await download.path();
  return { bytes: await readFile(path), fileName: download.suggestedFilename() };
}

export function sniffImageType(bytes: Buffer): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  return "application/octet-stream";
}

export type DecodedImage = {
  byteLength: number;
  contentHash: string;
  cornerAlpha: number;
  height: number;
  mediaType: string;
  width: number;
};

/** Decode an exported image in the page and read its size and top-right corner alpha. */
export async function decodeImage(page: Page, file: DownloadedFile): Promise<DecodedImage> {
  const mediaType = sniffImageType(file.bytes);
  const decoded = await page.evaluate(
    async ({ base64, type }) => {
      const blob = await (await fetch(`data:${type};base64,${base64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      const context = probe.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(bitmap, bitmap.width - 2, 2, 1, 1, 0, 0, 1, 1);
      const alpha = context.getImageData(0, 0, 1, 1).data[3];
      const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      return { alpha, hash, height: bitmap.height, width: bitmap.width };
    },
    { base64: file.bytes.toString("base64"), type: mediaType },
  );

  return {
    byteLength: file.bytes.byteLength,
    contentHash: decoded.hash,
    cornerAlpha: decoded.alpha,
    height: decoded.height,
    mediaType,
    width: decoded.width,
  };
}

export async function chooseSelectOption(page: Page, control: Locator, optionLabel: string): Promise<void> {
  const trigger = control.getByRole("combobox");
  const triggerLabel = async () => ((await trigger.textContent()) ?? "").replace(/[▼▾]/gu, "").trim();
  if ((await triggerLabel()) === optionLabel) return;
  await trigger.click();
  // The open list is rendered inside an aria-hidden layer, so match it by role attribute and text
  const option = page.locator("[role=option]").filter({ hasText: new RegExp(`^\\s*${optionLabel}\\s*$`) }).first();
  await expect(option).toBeVisible();
  // Keyboard selection: the list can open underneath the sticky export footer
  const labels = (await page.locator("[role=option]").allTextContents()).map((text) => text.trim());
  const selected = await page.locator("[role=option]").evaluateAll((options) =>
    options.findIndex((option) => option.getAttribute("aria-selected") === "true"),
  );
  const current = selected >= 0 ? selected : labels.indexOf(await triggerLabel());
  const wanted = labels.indexOf(optionLabel);
  const steps = wanted - Math.max(0, current);
  for (let i = 0; i < Math.abs(steps); i += 1) await page.keyboard.press(steps > 0 ? "ArrowDown" : "ArrowUp");
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText(optionLabel);
}

export async function clickExportPng(page: Page): Promise<DownloadedFile> {
  return downloadFrom(page, () => page.getByRole("button", { name: "Export PNG" }).click());
}

/** Scroll a panel control to the middle of the panel so the sticky export footer never covers it. */
export async function revealControl(control: Locator): Promise<void> {
  await control.evaluate((element) => element.scrollIntoView({ block: "center" }));
}

export async function revealTarget(page: Page, target: string): Promise<void> {
  const { getToolcraftControlFieldByTarget } = await import("./browser-control-target-helpers");
  await revealControl(await getToolcraftControlFieldByTarget(page, target));
}
