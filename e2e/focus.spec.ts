import { expect, test } from "@playwright/test";

test("a navigation focuses main without ringing it, and controls keep their ring", async ({
  page,
}) => {
  await page.goto("/characters");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Characters");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS("outline-style", "solid");
  await skip.press("Enter");
  const main = page.locator("main");
  await expect(main).toBeFocused();
  await expect(main).toHaveCSS("outline-style", "none");

  await page.getByRole("link", { name: "Settings" }).press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(main).toBeFocused();
  await expect(main).toHaveCSS("outline-style", "none");

  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveCSS("outline-style", "solid");
});
