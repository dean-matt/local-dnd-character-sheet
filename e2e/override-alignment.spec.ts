import { expect, test } from "@playwright/test";
import { derivedRecord } from "../packages/web/src/test/records.ts";
import { middle } from "./box.ts";
import { createCharacter } from "./character.ts";

test(`the Speed breakdown centers each mode's field on its label`, async ({ page, request }) => {
  const id = await createCharacter(request, `E2E Speed ${Date.now()}`);
  try {
    await page.route(`**/api/characters/${id}/derived`, (route) =>
      route.fulfill({ json: derivedRecord() }),
    );
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto(`/characters/${id}`);
    await page.getByRole("button", { name: /^Speed \d+/ }).click();

    const dialog = page.getByRole("group", { name: "Speed breakdown" });
    for (const mode of ["Walk", "Burrow", "Climb", "Fly", "Swim"]) {
      const field = dialog.getByRole("textbox", { name: `${mode} speed override` });
      const label = dialog.getByText(mode, { exact: true });
      await expect(field).toBeVisible();
      expect(Math.abs((await middle(field)) - (await middle(label)))).toBeLessThanOrEqual(1);
    }
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});

for (const { trigger, name } of [
  { trigger: /^Hit point maximum \d+/, name: "Hit point maximum" },
  { trigger: /^Armor Class \d+/, name: "Armor Class" },
]) {
  test(`the ${name} breakdown centers its Override field on its label`, async ({
    page,
    request,
  }) => {
    const id = await createCharacter(request, `E2E Override ${Date.now()}`);
    try {
      // CI runs with no content.db, so the derived block the breakdowns draw from is stubbed.
      await page.route(`**/api/characters/${id}/derived`, (route) =>
        route.fulfill({ json: derivedRecord() }),
      );
      await page.setViewportSize({ width: 1440, height: 800 });
      await page.goto(`/characters/${id}`);
      await page.getByRole("button", { name: trigger }).click();

      const dialog = page.getByRole("group", { name: `${name} breakdown` });
      const field = dialog.getByRole("textbox", { name: `${name} override` });
      const label = dialog.getByText("Override", { exact: true });
      await expect(field).toBeVisible();
      expect(Math.abs((await middle(field)) - (await middle(label)))).toBeLessThanOrEqual(1);
    } finally {
      await request.delete(`/api/characters/${id}`);
    }
  });
}
