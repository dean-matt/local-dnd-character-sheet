import { expect, test } from "@playwright/test";

test("pages reorder from the keyboard, keep focus, persist and restore", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/characters", {
    data: {
      name: `E2E Pages ${Date.now()}`,
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
  const nav = page.getByRole("navigation", { name: "Character pages" }).getByRole("link");

  try {
    await page.goto(`/characters/${id}/p/stats`);
    await page.getByRole("button", { name: "Manage pages" }).click();

    const down = page.getByRole("button", { name: "Move Stats down" });
    await down.focus();
    await page.keyboard.press("Enter");
    await expect(nav).toHaveText(["Spells", "Stats", "Inventory", "Features"]);
    await expect(down).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(nav).toHaveText(["Spells", "Inventory", "Stats", "Features"]);

    await page.getByRole("button", { name: "Hide Stats" }).click();
    await expect(page).toHaveURL(new RegExp(`/characters/${id}/p/spells$`));
    await expect(nav).toHaveText(["Spells", "Inventory", "Features"]);

    await page.reload();
    await expect(nav).toHaveText(["Spells", "Inventory", "Features"]);

    await page.getByRole("button", { name: "Manage pages" }).click();
    await page.getByRole("button", { name: "Restore defaults" }).click();
    await expect(nav).toHaveText(["Stats", "Spells", "Inventory", "Features"]);
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});
