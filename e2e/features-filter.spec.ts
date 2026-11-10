import { expect, test } from "@playwright/test";
import { createCharacter } from "./character";

test("the limited uses checkboxes tick and clear from the keyboard", async ({ page, request }) => {
  const id = await createCharacter(request, `E2E Features Filter ${Date.now()}`);
  try {
    // CI runs with no content.db, so the features read is stubbed.
    await page.route(`**/api/characters/${id}/features`, (route) =>
      route.fulfill({
        json: {
          groups: [
            {
              origin: "race",
              name: "Half-Orc",
              features: [
                { resolved: true, name: "Darkvision", source: "PHB", entries: [] },
                {
                  resolved: true,
                  name: "Relentless Endurance",
                  source: "PHB",
                  entries: [],
                  uses: { key: "relentless", count: 1, reset: "long" },
                },
              ],
            },
          ],
        },
      }),
    );
    await page.goto(`/characters/${id}/p/features`);
    const card = page.getByRole("region", { name: "Race Features" });
    await card.getByRole("button", { name: /^Filter / }).focus();
    await page.keyboard.press("Enter");
    const has = card.getByRole("checkbox", { name: "Has limited uses" });
    await page.keyboard.press("Tab");
    await expect(has).toBeFocused();

    await page.keyboard.press("Space");
    await expect(has).toBeChecked();
    await expect(card.getByText("Darkvision")).toBeHidden();

    await page.keyboard.press("Space");
    await expect(has).not.toBeChecked();
    await expect(card.getByText("Darkvision")).toBeVisible();
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});
