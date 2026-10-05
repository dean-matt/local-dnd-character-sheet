import { expect, test } from "@playwright/test";

const EVERY_PICKED_TYPE = [
  "action",
  "background",
  "class",
  "condition",
  "deity",
  "disease",
  "feat",
  "item",
  "language",
  "monster",
  "optfeature",
  "race",
  "sense",
  "skill",
  "spell",
  "subclass",
  "table",
  "variantrule",
  "vehicle",
];

test("the Mechanics menu holds every entry it can list without scrolling in a 1280x800 window", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Every picked entry at once, so the check holds for the day each becomes searchable.
  await page.route("**/api/search/types", (route) =>
    route.fulfill({ json: { types: EVERY_PICKED_TYPE } }),
  );
  await page.goto("/");

  await page.getByRole("button", { name: "Mechanics" }).click();
  const all = page.getByRole("link", { name: "All types…" });
  await expect(all).toBeVisible();
  await expect(page.getByRole("link", { name: "Variant Rules" })).toBeVisible();

  const { scrollHeight, clientHeight } = await all.evaluate((link) => {
    const menu = link.parentElement as HTMLElement;
    return { scrollHeight: menu.scrollHeight, clientHeight: menu.clientHeight };
  });
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
});
