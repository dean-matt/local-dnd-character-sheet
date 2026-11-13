import { expect, test } from "@playwright/test";
import { derivedRecord } from "../packages/web/src/test/records.ts";
import { box } from "./box.ts";
import { createCharacter } from "./character.ts";

const FIGHTER = { name: "Fighter", source: "XPHB" };
const feature = (name: string, level: number) => ({
  resolved: true,
  name,
  source: "XPHB",
  level,
  entries: ["Rules."],
});

test.beforeEach(({ page }) => page.setViewportSize({ width: 1280, height: 900 }));

test("the Actions card's items in a row share a vertical centre, with or without a Use button", async ({
  page,
  request,
}) => {
  const id = await createCharacter(request, `Actions Row ${test.info().retry}${Date.now()}`);
  try {
    // CI runs with no content.db, so the features and the pool behind Second Wind are stubbed.
    await page.route(`**/api/characters/${id}/features`, (route) =>
      route.fulfill({
        json: {
          groups: [
            {
              origin: "class",
              name: "Fighter",
              class: FIGHTER,
              features: [feature("Second Wind", 1), feature("Action Surge", 2)],
            },
          ],
        },
      }),
    );
    await page.route(`**/api/characters/${id}/derived`, (route) =>
      route.fulfill({
        json: {
          ...derivedRecord(),
          classResources: [
            {
              class: FIGHTER,
              key: "second_wind",
              maximum: { computed: 2, manual: null, terms: [] },
            },
          ],
        },
      }),
    );
    await page.goto(`/characters/${id}`);
    const card = page.getByRole("region", { name: "Actions" });
    await expect(card.getByRole("button", { name: /^Use / }).first()).toBeVisible();
    const items = card.getByRole("listitem");
    const boxes = await Promise.all((await items.all()).map((item) => box(item)));
    expect(boxes.length).toBeGreaterThan(3);

    const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
    const rows = boxes
      .toSorted((a, b) => a.y - b.y)
      .reduce<(typeof boxes)[]>((acc, b) => {
        const row = acc.at(-1);
        if (row && b.y < Math.max(...row.map((r) => r.y + r.height))) row.push(b);
        else acc.push([b]);
        return acc;
      }, []);
    expect(rows.some((row) => row.length > 1)).toBe(true);
    for (const row of rows) {
      const line = centre(row.reduce((a, b) => (a.height >= b.height ? a : b)));
      for (const b of row) expect(Math.abs(centre(b) - line)).toBeLessThanOrEqual(0.5);
    }
    const tallest = Math.max(...boxes.map((b) => b.height));
    for (const b of boxes) expect(Math.abs(b.height - tallest)).toBeLessThanOrEqual(0.5);
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});
