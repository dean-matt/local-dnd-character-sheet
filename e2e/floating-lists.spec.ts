import { expect, type Locator, type Page, test } from "@playwright/test";
import { box } from "./box";

// CI runs with no content.db, so the races the picker offers are stubbed at the network.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/search?*", (route) =>
    route.fulfill({
      json: {
        items: Array.from({ length: 20 }, (_, index) => ({
          type: "race",
          name: `Race ${index + 1}`,
          source: "XPHB",
          edition: "one",
        })),
        total: 20,
        limit: 20,
        offset: 0,
      },
    }),
  );
});

const pageHeight = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight);

async function expectInsideViewport(page: Page, list: Locator) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const b = await box(list);
  expect(b.height).toBeGreaterThan(40);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
}

for (const height of [800, 360]) {
  test(`an open race list floats inside a ${height}px window without growing the page`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height });
    await page.goto("/characters/new");
    const input = page.getByRole("combobox", { name: "Race" });
    await input.scrollIntoViewIfNeeded();
    const before = await pageHeight(page);

    await input.fill("Race");
    const list = page.getByRole("listbox", { name: "Race" });
    await expect(list.getByRole("option")).toHaveCount(20);
    await expectInsideViewport(page, list);
    expect(await pageHeight(page)).toBe(before);

    await input.press("ArrowDown");
    await expect(input).toHaveAttribute("aria-activedescendant", /option-0$/);
    await input.press("Escape");
    await expect(list).toBeHidden();
    // Out of the top layer, not just hidden, or a modal opened later would draw over it.
    await expect(page.locator(":popover-open")).toHaveCount(0);
  });

  test(`an open alignment list floats inside a ${height}px window without growing the page`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height });
    await page.goto("/characters/new");
    const button = page.getByRole("combobox", { name: "Alignment" });
    await button.scrollIntoViewIfNeeded();
    const before = await pageHeight(page);

    await button.click();
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await expectInsideViewport(page, list);
    expect(await pageHeight(page)).toBe(before);
  });
}
