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
  const menu = all.locator("..");
  await expect(menu.getByRole("link", { name: "Variant Rules" })).toBeVisible();

  const { scrollHeight, clientHeight } = await menu.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
});

for (const [button, columns] of [
  ["Homebrew", 2],
  ["Mechanics", 3],
] as const) {
  test(`the ${button} menu fills ${columns} columns top to bottom, and one column below sm`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route("**/api/search/types", (route) =>
      route.fulfill({ json: { types: EVERY_PICKED_TYPE } }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: new RegExp(`^${button}`) }).click();
    const links = page.locator("[data-menu-columns] a");
    const boxes = await links.evaluateAll((els) =>
      els.map((el) => {
        const { left, top } = el.getBoundingClientRect();
        return { left: Math.round(left), top: Math.round(top) };
      }),
    );
    const lefts = [...new Set(boxes.map((box) => box.left))].sort((a, b) => a - b);
    expect(lefts).toHaveLength(columns);
    const perColumn = lefts.map((left) => boxes.filter((box) => box.left === left));
    expect(perColumn.flat()).toEqual(boxes);
    for (const column of perColumn) {
      expect(column.map((box) => box.top)).toEqual(
        [...column.map((box) => box.top)].sort((a, b) => a - b),
      );
    }
    expect(perColumn[1]?.[0]?.top).toBe(perColumn[0]?.[0]?.top);

    await page.setViewportSize({ width: 600, height: 800 });
    const narrow = await links.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)),
    );
    expect(new Set(narrow).size).toBe(1);
  });
}
