import { expect, test } from "@playwright/test";
import { box } from "./box";

for (const width of [800, 1280]) {
  test(`at ${width}px wide the Explore cards sharing a row stand one height`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const explore = page.getByRole("region", { name: "Explore" });
    const search = explore.getByRole("link", { name: /^Search/ });
    await expect(search).toBeVisible();
    const cards = [
      search,
      ...[/^Settings/, /^Homebrew/].map((name) => explore.getByRole("link", { name })),
    ];
    const heights = new Map<number, Set<number>>();
    for (const b of await Promise.all(cards.map(box))) {
      const row = Math.round(b.y);
      heights.set(row, (heights.get(row) ?? new Set()).add(Math.round(b.height)));
    }
    for (const row of heights.values()) expect(row.size).toBe(1);
  });
}
