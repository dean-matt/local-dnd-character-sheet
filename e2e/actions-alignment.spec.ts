import { expect, test } from "@playwright/test";
import { box } from "./box.ts";

test.beforeEach(({ page }) => page.setViewportSize({ width: 1280, height: 900 }));

test("the Actions card's rows share a name column and a Use column, with or without a Use button", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/characters", {
    data: {
      name: `Actions Columns ${test.info().retry}${Date.now()}`,
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
    const uses = card.getByRole("button", { name: /^Use / });
    await expect(uses.first()).toBeVisible();
    const feature = (name: string) =>
      card.getByRole("listitem").filter({ has: page.getByRole("button", { name, exact: true }) });
    const withUse = feature("Second Wind");
    const without = feature("Action Surge");
    const [a, b] = [
      await box(withUse.getByRole("button", { name: "Second Wind", exact: true })),
      await box(without.getByRole("button", { name: "Action Surge", exact: true })),
    ];
    expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.width - b.width)).toBeGreaterThan(0.5);
    expect(Math.abs((await box(withUse)).x - (await box(without)).x)).toBeLessThanOrEqual(0.5);
    const use = await box(uses.first());
    expect(use.x).toBeGreaterThan(a.x + a.width);
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});
