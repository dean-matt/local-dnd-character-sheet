import { expect, type Locator, test } from "@playwright/test";
import { box, edges } from "./box";
import { createCharacter, scrollToBottom } from "./character";

// Headless Chromium hides every scrollbar unless this flag goes.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

/** The rail's scroll region, the first child of the column `Rail` draws in the aside. */
const ROWS = "> * > :first-child";

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
    // The page rows arrive after the first paint, so the rail scrolls again until they hold.
    await expect(async () => {
      await rail.locator(ROWS).evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      const railBox = await edges(rail);
      expect(railBox.top).toBe((await edges(page.getByRole("banner"))).bottom);
      expect(railBox.bottom).toBeLessThanOrEqual(240);
      const collapseBox = await edges(page.getByRole("button", { name: "Collapse sidebar" }));
      expect(collapseBox.top).toBeGreaterThanOrEqual(railBox.top);
      expect(collapseBox.bottom).toBeLessThanOrEqual(railBox.bottom);
    }).toPass();

    // A strip of the rail's left padding, where no row draws, so only the shadow changes it.
    const container = rail.locator(ROWS);
    const strip = async (edge: "top" | "bottom") => {
      const b = await box(container);
      const y = edge === "top" ? b.y + 2 : b.y + b.height - 6;
      return page.screenshot({ clip: { x: b.x + 4, y, width: 8, height: 4 } });
    };
    const scrollRail = (to: "top" | "bottom") =>
      container.evaluate((element, top) => {
        element.scrollTop = top ? 0 : element.scrollHeight;
      }, to === "top");
    await expect(async () => {
      await scrollRail("bottom");
      const atEnd = { top: await strip("top"), bottom: await strip("bottom") };
      await scrollRail("top");
      const atStart = { top: await strip("top"), bottom: await strip("bottom") };
      expect(atStart.top.equals(atEnd.bottom)).toBe(true);
      expect(atEnd.top.equals(atStart.top)).toBe(false);
      expect(atStart.bottom.equals(atEnd.bottom)).toBe(false);
    }).toPass();

    // A classic scrollbar, as Windows draws, takes its width from the collapsed rail and
    // pushes the icons off center. macOS overlays one, so the style draws it here.
    await page.addStyleTag({ content: "::-webkit-scrollbar { width: 16px; }" });
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    const centerX = async (locator: Locator) => {
      const b = await box(locator);
      return b.x + b.width / 2;
    };
    const icon = page.getByRole("navigation", { name: "Character pages" }).locator("svg").first();
    // Within the half pixel the rail's right border shifts its box center.
    await expect
      .poll(async () => Math.abs((await centerX(icon)) - (await centerX(rail))))
      .toBeLessThanOrEqual(0.5);
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});

for (const [name, path] of [
  ["character sheet", "stats"],
  ["Settings", "/settings"],
  ["Homebrew", "/homebrew/items"],
  ["creation flow", "/characters/new"],
] as const) {
  test(`on the ${name} page, a rail too short for its rows scrolls them under a pinned collapse toggle`, async ({
    page,
    request,
  }) => {
    const id =
      path === "stats" ? await createCharacter(request, `E2E Pinned ${Date.now()}`) : undefined;
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1280, height: 200 });
      await page.goto(id ? `/characters/${id}/p/stats` : path);
      await page.evaluate(() => localStorage.removeItem("sidebar-collapsed"));
      await page.reload();
      const rail = page.locator("aside");
      const rows = rail.locator(ROWS);

      for (const label of ["Collapse sidebar", "Expand sidebar"]) {
        const toggle = page.getByRole("button", { name: label });
        const divider = toggle.locator("..");
        const scrollRows = (top: boolean) =>
          rows.evaluate((element, top) => {
            element.scrollTop = top ? 0 : element.scrollHeight;
          }, top);
        // The page rows arrive after the first paint, so this holds once they have.
        await expect(async () => {
          expect(
            await rows.evaluate((element) => element.scrollHeight > element.clientHeight),
          ).toBe(true);
          await scrollRows(true);
          const railBox = await edges(rail);
          const atTop = await edges(divider);
          expect(atTop.top).toBeGreaterThanOrEqual(railBox.top);
          expect(atTop.bottom).toBeLessThanOrEqual(railBox.bottom);
          await scrollRows(false);
          expect(await edges(divider)).toEqual(atTop);
          expect(await rows.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        }).toPass();
        await toggle.click();
      }
    } finally {
      if (id) await request.delete(`/api/characters/${id}`);
    }
  });
}
