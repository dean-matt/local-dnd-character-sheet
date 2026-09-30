import { expect, test } from "@playwright/test";

// Each control is focused by locator rather than by Tab order: in dev, StrictMode runs the
// route-change focus on load, so where a first Tab lands depends on that effect's timing.
test("a navigation focuses main without ringing it, and controls keep their ring on screen only", async ({
  page,
}) => {
  await page.goto("/characters");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Characters");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await skip.focus();
  await expect(skip).toHaveCSS("outline-style", "solid");
  await skip.press("Enter");
  const main = page.locator("main");
  await expect(main).toBeFocused();
  await expect(main).toHaveCSS("outline-style", "none");

  await page.getByRole("link", { name: "Settings" }).press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(main).toBeFocused();
  await expect(main).toHaveCSS("outline-style", "none");

  const control = page.getByRole("button", { name: "Light" });
  await control.focus();
  await expect(control).toHaveCSS("outline-style", "solid");

  await page.emulateMedia({ media: "print" });
  await expect(control).toBeFocused();
  await expect(control).toHaveCSS("outline-style", "none");
});
