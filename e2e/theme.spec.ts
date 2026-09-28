import { expect, test } from "@playwright/test";
import { computedColor } from "./palette";

const cases = [
  { stored: "light", system: "dark", ground: "--color-gray-100", ink: "--color-gray-900" },
  { stored: "dark", system: "light", ground: "--color-gray-900", ink: "--color-gray-100" },
  { stored: null, system: "dark", ground: "--color-gray-900", ink: "--color-gray-100" },
  { stored: null, system: "light", ground: "--color-gray-100", ink: "--color-gray-900" },
] as const;

for (const { stored, system, ground, ink } of cases) {
  test(`a ${stored ?? "system"} theme on a ${system} system paints ${ink} on ${ground}`, async ({
    page,
  }) => {
    if (stored) await page.addInitScript((theme) => localStorage.setItem("theme", theme), stored);
    await page.emulateMedia({ colorScheme: system });
    await page.goto("/");

    const body = page.locator("body");
    await expect(body).toHaveCSS("background-color", await computedColor(page, ground));
    await expect(body).toHaveCSS("color", await computedColor(page, ink));
  });
}
