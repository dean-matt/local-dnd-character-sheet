import { expect, test } from "@playwright/test";

test("the Advanced search link stays in view below the results as they scroll", async ({
  page,
}) => {
  const items = Array.from({ length: 40 }, (_, i) => ({
    type: "spell",
    name: `Fire Spell ${i}`,
    source: "PHB",
    edition: "classic",
  }));
  await page.route(/\/api\/search\?/, (route) =>
    route.fulfill({ json: { items, total: items.length, limit: 40, offset: 0 } }),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Search characters and the compendium" }).fill("fire");

  const results = page.getByRole("listbox", { name: "Search results" });
  await expect(results.getByRole("option", { name: /Fire Spell 39/ })).toBeAttached();
  const link = page.getByRole("link", { name: /Advanced search for "fire"/ });
  expect(await results.locator("a").count()).toBe(0);
  expect(await results.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

  await results.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(link).toBeInViewport({ ratio: 1 });
  const [list, footer] = [await results.boundingBox(), await link.boundingBox()];
  expect(list && footer).toBeTruthy();
  if (!list || !footer) return;
  expect(footer.y).toBeGreaterThanOrEqual(list.y + list.height);
});
