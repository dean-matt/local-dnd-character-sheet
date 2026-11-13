import { expect, test } from "@playwright/test";
import { box } from "./box.ts";

test.beforeEach(({ page }) => page.setViewportSize({ width: 1280, height: 900 }));

test("the Actions card's items in a row share a vertical centre, with or without a Use button", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/characters", {
    data: {
      name: `Actions Row ${test.info().retry}${Date.now()}`,
      edition: "one",
      levels: [
        { class: { name: "Fighter", source: "XPHB" } },
        { class: { name: "Fighter", source: "XPHB" } },
      ],
      race: { name: "Human", source: "XPHB" },
      background: { name: "Soldier", source: "XPHB" },
      abilityScores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
      proficiencies: {
        savingThrows: [],
        skills: [],
        armor: [],
        weapons: [],
        tools: [],
        languages: [],
      },
      inventory: [],
      spells: [],
    },
  });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).id as string;
  try {
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
