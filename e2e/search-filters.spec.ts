import { expect, test } from "@playwright/test";

for (const [width, colorScheme] of [
  [1280, "light"],
  [1280, "dark"],
  [900, "light"],
] as const) {
  test(`the source list stays inside the search sidebar at ${width}px, ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width, height: 800 });
    // A title far longer than the rail, so an unconstrained row would outgrow it.
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
    const button = rail.getByRole("button", { name: "Source All sources" });
    await button.click();
    const list = rail.getByRole("group", { name: "Sources to search" });
    const long = list.locator("label").filter({ hasText: "Long Sourcebook" });
    await expect(long).toBeVisible();
    const railBox = await rail.boundingBox();
    expect(railBox).toBeTruthy();
    if (!railBox) return;
    for (const box of [
      await button.boundingBox(),
      await list.boundingBox(),
      await long.boundingBox(),
    ]) {
      expect(box).toBeTruthy();
      if (!box) return;
      expect(box.x).toBeGreaterThanOrEqual(railBox.x);
      expect(box.x + box.width).toBeLessThanOrEqual(railBox.x + railBox.width);
    }
  });
}

test("a click anywhere on a row ticks it and keeps the list open", async ({ page }) => {
  await page.route("**/api/search/types", (route) =>
    route.fulfill({ json: { types: ["spell", "item"] } }),
  );
  await page.goto("/search");
  await page.getByRole("button", { name: "Type All types" }).click();
  const list = page.getByRole("group", { name: "Types to search" });
  const spells = list.getByRole("checkbox", { name: "Spells" });
  const box = await list.locator("label").filter({ hasText: "Spells" }).boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  // The row's far end, past its text, where only the row itself can take the click.
  await page.mouse.click(box.x + box.width - 8, box.y + box.height / 2);
  await expect(spells).toBeChecked();
  await expect(list).toBeVisible();
});

test("a click on a source row's text ticks it and keeps the source list open", async ({ page }) => {
  await page.route("**/api/search/sources", (route) =>
    route.fulfill({ json: { sources: ["PHB", "XGE"] } }),
  );
  await page.route("**/api/catalog/sources", (route) => route.fulfill({ json: { sources: [] } }));
  await page.goto("/search");
  await page.getByRole("button", { name: "Source All sources" }).click();
  const list = page.getByRole("group", { name: "Sources to search" });
  await list.getByText("XGE", { exact: true }).click();
  await expect(list.getByRole("checkbox", { name: "XGE" })).toBeChecked();
  await expect(list).toBeVisible();
  await expect(page).toHaveURL(/source=XGE/);
  await expect(page.getByRole("button", { name: "Source XGE" })).toBeVisible();
});
