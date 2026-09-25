import { expect, test } from "@playwright/test";

test("a character prints its visible pages in light ink, with the screen chrome left out", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/characters", {
    data: {
      name: `E2E Print ${Date.now()}`,
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
    const pages = await (await request.get(`/api/characters/${id}/pages`)).json();
    const hidden = await request.put(`/api/characters/${id}/pages`, {
      data: pages.map(({ preset: _preset, ...rest }: { preset: boolean; slug: string }) => ({
        ...rest,
        hidden: rest.slug === "inventory",
      })),
    });
    expect(hidden.ok()).toBe(true);

    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.emulateMedia({ media: "print" });
    await page.goto(`/characters/${id}/p/stats`);

    const sheet = page.locator("[data-print-sheet]");
    await expect(sheet.getByRole("heading", { level: 1 })).toHaveText([
      "Stats",
      "Spells",
      "Features",
    ]);
    await expect(page.getByRole("banner")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Character pages" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Manage pages" })).toBeHidden();
    await expect(page.locator("main")).toHaveCSS("outline-style", "none");

    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    // 12pt is 16px at the 96dpi a browser lays print out at.
    await expect(sheet.locator(".text-row").first()).toHaveCSS("font-size", "16px");
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});
