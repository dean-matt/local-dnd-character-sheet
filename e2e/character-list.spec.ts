import { expect, test } from "@playwright/test";
import { createCharacter } from "./character";

test("importing a character shows it in the list", async ({ page, request }) => {
  const name = `E2E Import ${Date.now()}`;
  const id = await createCharacter(request, name);

  try {
    await page.goto("/characters");
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});
