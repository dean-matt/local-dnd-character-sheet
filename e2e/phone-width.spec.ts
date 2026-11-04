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

for (const width of [320, 390]) {
  test(`at ${width}px wide the Homebrew page's actions and cards wrap, each control in reach of Tab`, async ({
    page,
    request,
  }) => {
    const name = `Phone Width Feat With A Long Name ${test.info().retry}${Date.now()}`;
    const saved = await request.post("/api/homebrew/feats", {
      data: { edition: "one", name, category: "O", entries: ["A long line of rules text."] },
    });
    expect(saved.ok()).toBe(true);
    try {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/homebrew/feats");
      // The expanded rail leaves a phone too little room for any page; the page is judged beside the collapsed one.
      await page.getByRole("button", { name: "Collapse sidebar" }).click();
      const section = page.getByRole("region", { name: "Feats" });
      await expect(section.getByRole("button", { name, exact: true })).toBeVisible();

      // The rail animates its width, so the page fits only once the collapse settles.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      const controls = [
        section.getByRole("button", { name: "Import" }),
        section.getByRole("button", { name: "Export" }),
        section.getByRole("button", { name: "Add feat" }),
        section.getByRole("checkbox", { name: `Select ${name} for export` }),
        section.getByRole("button", { name, exact: true }),
        section.getByRole("button", { name: `Delete ${name}` }),
      ];
      for (const control of controls) {
        const b = await box(control);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(width);
      }
      await page.keyboard.press("Tab");
      for (const control of controls) {
        for (
          let i = 0;
          i < 40 && !(await control.evaluate((el) => el === document.activeElement));
          i++
        ) {
          await page.keyboard.press("Tab");
        }
        await expect(control).toBeFocused();
      }
    } finally {
      await request.delete(`/api/homebrew/feats/${(await saved.json()).id}`);
    }
  });
}
