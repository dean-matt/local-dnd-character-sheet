import { type APIRequestContext, expect, test } from "@playwright/test";
import type { CharacterDefinition } from "../packages/character/src/index.ts";
import { derivedRecord } from "../packages/web/src/test/records.ts";

/** Saves one homebrew race, class, background and feat in the 2024 edition, named by `tag`. */
async function saveHomebrew(request: APIRequestContext, tag: string) {
  const save = async (collection: string, data: object) => {
    const response = await request.post(`/api/homebrew/${collection}`, {
      data: { edition: "one", ...data },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()) as { id: string; name: string };
  };
  return {
    race: await save("races", { name: `Emberkin ${tag}`, size: ["M"], speed: 30 }),
    class: await save("classes", { name: `Warden ${tag}`, hd: { number: 1, faces: 10 } }),
    background: await save("backgrounds", { name: `Ferryman ${tag}` }),
    feat: await save("feats", { name: `Quick Study ${tag}`, category: "O" }),
  };
}

const tagFor = () => `${test.info().retry + 1}${Date.now()}`;

test("top-bar search finds homebrew races, classes, backgrounds and feats and opens each one's detail", async ({
  page,
  request,
}) => {
  const rows = await saveHomebrew(request, tagFor());
  const hits = (["race", "class", "background", "feat"] as const).map((type) => ({
    type,
    id: rows[type].id,
    name: rows[type].name,
    edition: "one",
  }));
  // CI runs with no content.db, so `/search` answers with the hits it merges for these rows.
  await page.route(/\/api\/search\?/, (route) =>
    route.fulfill({ json: { items: hits, total: hits.length, limit: 20, offset: 0 } }),
  );
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search characters and the compendium" });

  for (const hit of hits) {
    await search.fill(hit.name);
    const results = page.getByRole("listbox", { name: "Search results" });
    const option = results.getByRole("option", { name: new RegExp(`${hit.name}.*Homebrew`) });
    await expect(option).toBeVisible();
    await option.click();
    const detail = page.getByRole("dialog", { name: hit.name, exact: true });
    await expect(detail).toBeVisible();
    if (hit.type === "feat")
      await expect(detail.getByRole("button", { name: /Add to/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
  }
});

test("a sheet names its homebrew race, class, background and feat wherever a catalog row's name shows", async ({
  page,
  request,
}) => {
  const rows = await saveHomebrew(request, tagFor());
  const cls = { homebrewId: rows.class.id };
  const definition = {
    name: `E2E Homebrew Names ${Date.now()}`,
    edition: "one",
    levels: Array.from({ length: 4 }, () => ({ class: cls })),
    race: { homebrewId: rows.race.id },
    background: { homebrewId: rows.background.id },
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
    feats: [
      { ref: { homebrewId: rows.feat.id }, grantedBy: { kind: "class", ref: cls }, level: 4 },
    ],
  };
  const created = await request.post("/api/characters", { data: definition });
  expect(created.ok()).toBe(true);
  const { id, definition: stored } = (await created.json()) as {
    id: string;
    definition: CharacterDefinition;
  };
  // CI runs with no content.db, so the derived block is stubbed, casting with the homebrew class.
  await page.route(`**/api/characters/${id}/derived`, (route) =>
    route.fulfill({ json: derivedRecord(stored, cls) }),
  );

  await page.goto(`/characters/${id}/p/identity`);
  await expect(page.getByRole("region", { name: "Race" })).toContainText(rows.race.name);
  await expect(page.getByRole("region", { name: "Background" })).toContainText(
    rows.background.name,
  );
  await expect(page.getByRole("region", { name: "Class" })).toContainText(`${rows.class.name} 4`);

  await page.goto(`/characters/${id}/p/level`);
  const fourth = page.getByRole("row", { name: new RegExp(`^4 ${rows.class.name} 4`) });
  await expect(fourth).toContainText(`Improvement: ${rows.feat.name}`);

  await page.goto(`/characters/${id}/p/spells`);
  await expect(
    page.getByRole("button", { name: `${rows.class.name} Spell Attack Bonus +5` }),
  ).toBeVisible();
  await expect(page.getByText(`${rows.class.name}: 0 of 2 prepared`).first()).toBeVisible();

  await page.goto(`/characters/${id}/p/stats`);
  await expect(page.getByText(`${rows.class.name} spell attack`).first()).toBeVisible();
});
