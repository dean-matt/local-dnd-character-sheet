import { expect, test } from "@playwright/test";

for (const [width, colorScheme] of [
  [1280, "light"],
  [1280, "dark"],
  [900, "light"],
] as const) {
  test(`the source select stays inside the search sidebar at ${width}px, ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width, height: 800 });
    // A title far longer than the rail, so an unconstrained select would outgrow it.
    await page.route("**/api/search/sources", (route) =>
      route.fulfill({ json: { sources: ["PHB", "LONG"] } }),
    );
    await page.route("**/api/catalog/sources", (route) =>
      route.fulfill({
        json: {
          sources: [
            {
              source: "LONG",
              name: `The ${"Exceedingly ".repeat(12)}Long Sourcebook`,
              group: null,
            },
          ],
        },
      }),
    );
    await page.goto("/search");

    const rail = page.getByRole("complementary", { name: "Search filters" });
    const select = rail.getByRole("combobox", { name: "Narrow by source" });
    await expect(select).toBeVisible();
    const railBox = await rail.boundingBox();
    const selectBox = await select.boundingBox();
    expect(selectBox && railBox).toBeTruthy();
    if (!selectBox || !railBox) return;
    expect(selectBox.x + selectBox.width).toBeLessThanOrEqual(railBox.x + railBox.width);
  });
}
