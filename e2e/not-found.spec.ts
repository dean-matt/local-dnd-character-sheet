import { expect, test } from "@playwright/test";

test("a wrong URL reaches the not-found state, not a blank sheet", async ({ page }) => {
  await page.goto("/this/goes/nowhere");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});
