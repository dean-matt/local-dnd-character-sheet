import { expect, test } from "@playwright/test";
import { characterRecord, derivedRecord } from "../packages/web/src/test/records.ts";
import { box } from "./box";

let character: string | undefined;

test.afterEach(async ({ request }) => {
  if (character) await request.delete(`/api/characters/${character}`);
  character = undefined;
});

test("a spent hit die's tooltip draws past the Short rest dialog's edge without resizing its body", async ({
  page,
  request,
}) => {
  const warlock = { class: { name: "Warlock", source: "XPHB" } };
  const levels = Array.from({ length: 6 }, () => warlock);
  const created = await request.post("/api/characters", {
    data: {
      name: `E2E Hit Die ${Date.now()}`,
      edition: "one",
      levels,
      race: { name: "Human", source: "XPHB" },
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
  expect(created.ok()).toBe(true);
  const id = (await created.json()).id as string;
  character = id;
  const { state } = await (await request.get(`/api/characters/${id}/state`)).json();
  const put = await request.put(`/api/characters/${id}/state`, {
    data: { ...state, hitPoints: { current: 1, temporary: 0 } },
  });
  expect(put.ok()).toBe(true);

  // CI runs with no content.db, so the derived block that sizes the hit dice pool and the
  // features a rest restores are stubbed.
  const definition = { ...characterRecord(id, "Vex").definition, levels };
  await page.route(`**/api/characters/${id}/derived`, (route) =>
    route.fulfill({ json: derivedRecord(definition) }),
  );
  await page.route(`**/api/characters/${id}/features`, (route) =>
    route.fulfill({ json: { groups: [] } }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/characters/${id}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Rest", exact: true }).click();
  await page.getByRole("button", { name: /^Short rest/ }).click();
  const dialog = page.getByRole("dialog", { name: "Short rest" });
  // Five of six dice, so the last spent one sits near the dialog's right edge.
  for (let spent = 1; spent <= 5; spent++) {
    await dialog.getByRole("button", { name: /^Roll d8/ }).click();
    await expect(dialog.getByRole("img", { name: /^d8: rolled/ })).toHaveCount(spent);
  }

  const body = dialog.getByRole("region", { name: "Short rest" });
  const size = () =>
    body.evaluate((element) => [element.scrollWidth, element.scrollHeight].join("x"));
  const before = await size();
  await dialog
    .getByRole("img", { name: /^d8: rolled/ })
    .last()
    .hover();

  const tooltip = page.locator(":popover-open");
  await expect(tooltip).toBeVisible();
  const tooltipBox = await box(tooltip);
  const dialogBox = await box(dialog);
  expect(tooltipBox.x + tooltipBox.width).toBeGreaterThan(dialogBox.x + dialogBox.width);
  expect(await size()).toBe(before);
});
