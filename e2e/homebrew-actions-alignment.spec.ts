import { expect, test } from "@playwright/test";
import { box } from "./box.ts";

test.beforeEach(({ page }) => page.setViewportSize({ width: 1280, height: 800 }));

test("the Homebrew page's Import button starts at the cards' left edge, with or without entries", async ({
  page,
  request,
}) => {
  const name = `Actions Line ${test.info().retry}${Date.now()}`;
  const saved = await request.post("/api/homebrew/feats", {
    data: { edition: "one", name, category: "O" },
  });
  expect(saved.ok()).toBe(true);
  try {
    await page.goto("/homebrew/feats");
    const section = page.getByRole("region", { name: "Feats" });
    const row = section.getByRole("listitem").filter({ hasText: name });
    const card = await box(row.locator("> div"));
    const checkbox = await box(row.getByRole("checkbox", { name: `Select ${name} for export` }));
    const importButton = section.getByRole("button", { name: "Import" });

    expect(Math.abs((await box(importButton)).x - card.x)).toBeLessThanOrEqual(0.5);
    expect(checkbox.x + checkbox.width).toBeLessThan(card.x);

    await page.route(/\/api\/homebrew\/feats$/, (route) =>
      route.request().method() === "GET" ? route.fulfill({ json: [] }) : route.fallback(),
    );
    await page.reload();
    await expect(section.getByText("No homebrew feats yet.")).toBeVisible();
    expect(Math.abs((await box(importButton)).x - card.x)).toBeLessThanOrEqual(0.5);
  } finally {
    await request.delete(`/api/homebrew/feats/${(await saved.json()).id}`);
  }
});
