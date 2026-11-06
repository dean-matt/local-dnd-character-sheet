import { expect, test } from "@playwright/test";
import { derivedRecord } from "../packages/web/src/test/records.ts";
import { box } from "./box";
import { createCharacter } from "./character";

const computed = (value: number) => ({ computed: value, manual: null, terms: [] });

for (const width of [320, 390, 1280]) {
  test(`at ${width}px wide the Class Resources buttons stand in one column and the card fits`, async ({
    page,
    request,
  }) => {
    const id = await createCharacter(request, `E2E Class Resources ${Date.now()}`);
    try {
      // CI runs with no content.db, so the derived block that lists the pools is stubbed.
      await page.route(`**/api/characters/${id}/derived`, (route) =>
        route.fulfill({
          json: {
            ...derivedRecord(),
            classResources: [
              {
                class: { name: "Monk", source: "XPHB" },
                key: "focus_points",
                maximum: computed(20),
              },
              { class: { name: "Barbarian", source: "XPHB" }, key: "rages", maximum: computed(3) },
            ],
          },
        }),
      );
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/characters/${id}/p/features`);
      if (width < 768) await page.getByRole("button", { name: "Collapse sidebar" }).click();
      const card = page.getByRole("region", { name: "Class Resources" });
      const columns = await Promise.all(
        ["Spend a use of", "Restore a use of", "Reset"].map(async (action) =>
          Promise.all(
            ["Focus points, Monk", "Rages, Barbarian"].map(
              async (pool) =>
                (await box(card.getByRole("button", { name: `${action} ${pool}` }))).x,
            ),
          ),
        ),
      );
      for (const [first, second] of columns) expect(first).toBe(second);

      // The card alone is judged: at 320px the character header overflows on its own.
      const b = await box(card);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
      expect(await card.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
    } finally {
      await request.delete(`/api/characters/${id}`);
    }
  });
}
