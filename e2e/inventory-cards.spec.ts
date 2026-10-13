import { expect, test } from "@playwright/test";
import { derivedRecord } from "../packages/web/src/test/records.ts";
import { box } from "./box";
import { createCharacter } from "./character";

for (const width of [800, 1440]) {
  test(`at ${width}px wide the Inventory cards sharing a row stand one height`, async ({
    page,
    request,
  }) => {
    const id = await createCharacter(request, `E2E Inventory ${Date.now()}`);
    try {
      // CI runs with no content.db, so the derived block that renders Carrying and Attunement is stubbed.
      await page.route(`**/api/characters/${id}/derived`, (route) =>
        route.fulfill({ json: derivedRecord() }),
      );
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/characters/${id}/p/inventory`);
      const cards = ["Carrying", "Attunement", "Currency"].map((name) =>
        page.getByRole("region", { name }),
      );
      for (const card of cards) await expect(card).toBeVisible();
      const heights = new Map<number, Set<number>>();
      for (const b of await Promise.all(cards.map(box))) {
        const row = Math.round(b.y);
        heights.set(row, (heights.get(row) ?? new Set()).add(Math.round(b.height)));
      }
      expect(heights.size).toBe(width >= 1280 ? 1 : 2);
      for (const row of heights.values()) expect(row.size).toBe(1);

      const titleRow = (name: string) =>
        page.getByRole("heading", { name, level: 3 }).locator("..");
      const plain = await box(titleRow("Carrying"));
      expect((await box(titleRow("Currency"))).height).toBe(plain.height);
      const info = await box(page.getByRole("button", { name: "How to enter coins" }));
      expect(Math.min(info.width, info.height)).toBeGreaterThanOrEqual(24);
    } finally {
      await request.delete(`/api/characters/${id}`);
    }
  });
}
