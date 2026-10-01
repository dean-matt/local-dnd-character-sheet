import { expect, test } from "@playwright/test";
import { createCharacter } from "./character";

test("pages reorder from the keyboard, keep focus, persist and restore", async ({
  page,
  request,
}) => {
  const id = await createCharacter(request, `E2E Pages ${Date.now()}`);
  const nav = page.getByRole("navigation", { name: "Character pages" }).getByRole("link");
  const later = ["Identity", "Level", "Alignment", "Notes"];

  try {
    await page.goto(`/characters/${id}/p/stats`);
    await page.getByRole("button", { name: "Manage pages" }).click();

    const down = page.getByRole("button", { name: "Move Stats down" });
    await down.focus();
    await page.keyboard.press("Enter");
    await expect(nav).toHaveText(["Spells", "Stats", "Inventory", "Features", ...later]);
    await expect(down).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(nav).toHaveText(["Spells", "Inventory", "Stats", "Features", ...later]);

    await page.getByRole("button", { name: "Hide Stats" }).click();
    await expect(page).toHaveURL(new RegExp(`/characters/${id}/p/spells$`));
    await expect(nav).toHaveText(["Spells", "Inventory", "Features", ...later]);

    await page.reload();
    await expect(nav).toHaveText(["Spells", "Inventory", "Features", ...later]);

    await page.getByRole("button", { name: "Manage pages" }).click();
    await page.getByRole("button", { name: "Restore defaults" }).click();
    await expect(nav).toHaveText(["Stats", "Spells", "Inventory", "Features", ...later]);
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});

test("modal closes on Escape and returns focus to the Manage button", async ({ page, request }) => {
  const id = await createCharacter(request, `E2E Pages Esc ${Date.now()}`);

  try {
    await page.goto(`/characters/${id}/p/stats`);
    const manageBtn = page.getByRole("button", { name: "Manage pages" });
    await manageBtn.click();
    await page.getByRole("dialog", { name: "Manage pages" }).waitFor();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog", { name: "Manage pages" })).not.toBeVisible();
    await expect(manageBtn).toBeFocused();
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});
