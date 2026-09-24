import { expect, test } from "@playwright/test";

test("importing a character shows it in the list", async ({ page, request }) => {
  const name = `E2E Import ${Date.now()}`;
  const response = await request.post("/api/characters", {
    data: {
      name,
      edition: "one",
      levels: [{ class: { name: "Warlock", source: "XPHB" } }],
      race: { name: "Half-Elf", source: "XPHB" },
      background: { name: "Charlatan", source: "XPHB" },
      abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
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
  expect(response.ok()).toBe(true);
  const { id } = await response.json();

  try {
    await page.goto("/");
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});
