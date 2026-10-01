import { expect, type Locator, test } from "@playwright/test";
import { box, edges, scrollToBottom } from "./box";
import { createCharacter } from "./character";

// Headless Chromium hides every scrollbar unless this flag goes.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test("in a window shorter than the rail, every rail row scrolls into view and the rail stays pinned", async ({
  page,
  request,
}) => {
  const id = await createCharacter(request, `E2E Short ${Date.now()}`);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 240 });
    await page.goto(`/characters/${id}/p/stats`);
    const rail = page.locator("aside");
    await scrollToBottom(page, rail.locator("xpath=following-sibling::*"));
    await rail.locator("> *").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    const railBox = await edges(rail);
    expect(railBox.top).toBe((await edges(page.getByRole("banner"))).bottom);
    expect(railBox.bottom).toBeLessThanOrEqual(240);
    const collapseBox = await edges(page.getByRole("button", { name: "Collapse sidebar" }));
    expect(collapseBox.top).toBeGreaterThanOrEqual(railBox.top);
    expect(collapseBox.bottom).toBeLessThanOrEqual(railBox.bottom);

    // A classic scrollbar, as Windows draws, takes its width from the collapsed rail and
    // pushes the icons off center. macOS overlays one, so the style draws it here.
    await page.addStyleTag({ content: "::-webkit-scrollbar { width: 16px; }" });
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    const centerX = async (locator: Locator) => {
      const b = await box(locator);
      return b.x + b.width / 2;
    };
    const icon = page.getByRole("navigation", { name: "Character pages" }).locator("svg").first();
    // Within the half pixel the rail's right border shifts its box center.
    expect(Math.abs((await centerX(icon)) - (await centerX(rail)))).toBeLessThanOrEqual(0.5);
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});
