import { expect, type Locator, test } from "@playwright/test";
import { box } from "./box.ts";
import { createCharacter } from "./character.ts";

async function middle(locator: Locator) {
  const b = await box(locator);
  return b.y + b.height / 2;
}

const fontSize = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).fontSize);

for (const rolled of [true, false]) {
  test(`the Roll Log's Filter${rolled ? ", Clear" : ""} and the dock's Close button share a vertical center${rolled ? "" : " with no rolls"}`, async ({
    page,
    request,
  }) => {
    const id = await createCharacter(request, `E2E Dock Header ${Date.now()}`);
    try {
      const rolls = rolled
        ? [
            {
              id: 1,
              type: "custom",
              label: "1d20",
              notation: "1d20",
              total: 12,
              dice: [{ faces: 20, value: 12, kept: true, sign: 1 }],
              modifier: 0,
              critical: false,
              characterId: id,
              characterName: "E2E Dock Header",
              rolledAt: "2026-01-01T12:00:00.000Z",
            },
          ]
        : [];
      await page.route(/\/api\/rolls$/, (route) =>
        route.request().method() === "GET" ? route.fulfill({ json: rolls }) : route.fallback(),
      );
      await page.setViewportSize({ width: 1440, height: 800 });
      await page.goto(`/characters/${id}`);
      await page.getByRole("button", { name: "Roll Log", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Roll Log", exact: true })).toBeVisible();

      const close = page.getByRole("button", { name: "Close side panel" });
      const filter = page.getByRole("button", { name: /^Filter Roll Log/ });
      const clear = page.getByRole("button", { name: "Clear Roll Log" });
      await expect(clear).toHaveCount(rolled ? 1 : 0);

      const center = await middle(close);
      expect(Math.abs((await middle(filter)) - center)).toBeLessThanOrEqual(1);
      if (rolled) {
        expect(Math.abs((await middle(clear)) - center)).toBeLessThanOrEqual(1);
        expect(await fontSize(filter)).toBe(await fontSize(clear));
      }
    } finally {
      await request.delete(`/api/characters/${id}`);
    }
  });
}
