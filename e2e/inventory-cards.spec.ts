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

const item = (name: string, type: { abbreviation: string; name: string } | null) => ({
  resolved: true,
  name,
  source: "XDMG",
  quantity: 1,
  carried: true,
  equipped: false,
  attuned: false,
  type,
  rarity: "very rare",
  value: 500000,
  estimate: null,
  weapon: null,
  armor: null,
  entries: [],
  requiresAttunement: true,
  weight: 6,
});

/** The sword's attack, held one-handed so its row draws the grip toggle as well. */
const attack = {
  entry: 0,
  ability: "str",
  attackBonus: { computed: 4, manual: null, terms: [] },
  critThreshold: { computed: 20, manual: null, terms: [] },
  damage: { dice: "1d8", type: "slashing", modifier: { computed: 4, manual: null, terms: [] } },
  grip: { held: "one-handed", twoHandedBlocked: false },
  mastery: [],
  range: null,
  ammunition: null,
  reload: null,
};

for (const width of [390, 800, 1280, 1440]) {
  test(`at ${width}px wide Weapons, Armor and Gear share a row only from xl`, async ({
    page,
    request,
  }) => {
    const id = await createCharacter(request, `E2E Item Columns ${Date.now()}`);
    try {
      // CI runs with no content.db, so both the derived block and the items are stubbed.
      await page.route(`**/api/characters/${id}/derived`, (route) =>
        route.fulfill({ json: { ...derivedRecord(), attacks: [attack] } }),
      );
      await page.route(`**/api/characters/${id}/inventory`, (route) =>
        route.fulfill({
          json: {
            items: [
              {
                ...item("Sword of the Unyielding Sentinel", {
                  abbreviation: "M",
                  name: "Melee Weapon",
                }),
                weapon: { category: "martial", damage: { dice: "1d8", type: "slashing" } },
              },
              item("Instrument of the Bards, Ollamh Harp", null),
            ],
          },
        }),
      );
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/characters/${id}/p/inventory`);
      const cards = ["Weapons", "Armor", "Gear"].map((name) => page.getByRole("region", { name }));
      for (const card of cards) await expect(card).toBeVisible();
      const armor = page.getByRole("region", { name: "Armor" });
      await expect(armor).toContainText("No armor.");
      await expect(page.getByRole("button", { name: /attack bonus \+4$/ })).toBeVisible();

      const boxes = await Promise.all(cards.map(box));
      const rows = new Set(boxes.map((b) => Math.round(b.y)));
      expect(rows.size).toBe(width >= 1280 ? 1 : 3);
      if (width >= 1280) {
        expect(new Set(boxes.map((b) => Math.round(b.width))).size).toBe(1);
      }
      // At 390px the sidebar leaves a row narrower than its damage chip.
      for (const card of width > 390 ? cards : []) {
        const outer = await box(card);
        for (const control of await card.locator("li *").all()) {
          if (!(await control.isVisible())) continue;
          const b = await box(control);
          expect(b.x).toBeGreaterThanOrEqual(outer.x - 0.5);
          expect(b.x + b.width).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
        }
      }
      // Bounded by the content column, not the window: the character header owns the page's width.
      const column = await box(armor.locator(".."));
      for (const b of boxes)
        expect(b.x + b.width).toBeLessThanOrEqual(column.x + column.width + 0.5);
    } finally {
      await request.delete(`/api/characters/${id}`);
    }
  });
}
