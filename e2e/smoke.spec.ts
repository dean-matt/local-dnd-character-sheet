import { expect, test } from "@playwright/test";

test("the app loads and renders its heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("local-dnd-character-sheet");
});

// Through the Vite proxy, so the run waits on one server rather than racing two.
test("the api answers its health probe", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "ok" });
});
