import { expect, type Page, test } from "@playwright/test";

/**
 * index.css's reduced-motion rule covers every element, so this targets one
 * created fresh in the page rather than any particular component.
 */
async function transitionDurationMs(page: Page): Promise<number> {
  const value = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.transitionProperty = "opacity";
    probe.style.transitionDuration = "500ms";
    document.body.appendChild(probe);
    const duration = getComputedStyle(probe).transitionDuration;
    probe.remove();
    return duration;
  });

  const match = value.match(/^([\d.eE+-]+)(ms|s)$/);
  if (!match) throw new Error(`unexpected transition-duration: ${value}`);
  const [, amount, unit] = match;
  return unit === "s" ? Number(amount) * 1000 : Number(amount);
}

test("prefers-reduced-motion collapses transitions on any element", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await transitionDurationMs(page)).toBeLessThan(1);
});

test("transitions run at their authored duration with no stated preference", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  expect(await transitionDurationMs(page)).toBe(500);
});
