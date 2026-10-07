import { expect, test } from "@playwright/test";
import { box } from "./box";

for (const width of [320, 390]) {
  test(`at ${width}px wide the top bar fits inside the window`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const settings = page.getByRole("banner").getByRole("link", { name: "Settings" });
    await expect(settings).toBeVisible();
    const b = await box(settings);
    expect(b.x + b.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}
