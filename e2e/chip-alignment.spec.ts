import { expect, type Locator, test } from "@playwright/test";
import { box } from "./box.ts";
import { createCharacter } from "./character.ts";

const chipOf = (text: Locator) =>
  text.locator("xpath=ancestor-or-self::span[contains(@class,'rounded-chip')][1]");

/** The box of the glyphs alone, which a chip's text node spans without its padding. */
const textBox = (text: Locator) =>
  text.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const { y, height } = range.getBoundingClientRect();
    return { y, height };
  });

/** The edition chip and `other` share a top, a bottom and a text midline, to a quarter pixel. */
async function expectAligned(edition: Locator, other: Locator) {
  const [a, b] = [await box(chipOf(edition)), await box(chipOf(other))];
  const [textA, textB] = [await textBox(edition), await textBox(other)];
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(0.25);
  expect(Math.abs(a.y + a.height - (b.y + b.height))).toBeLessThanOrEqual(0.25);
  expect(Math.abs(textA.y + textA.height / 2 - (textB.y + textB.height / 2))).toBeLessThanOrEqual(
    0.25,
  );
}

test.beforeEach(({ page }) => page.setViewportSize({ width: 1280, height: 800 }));

test("a homebrew entry's edition chip lines up with the Homebrew chip beside it", async ({
  page,
  request,
}) => {
  const name = `Chip Line ${test.info().retry}${Date.now()}`;
  const saved = await request.post("/api/homebrew/feats", {
    data: { edition: "one", name, category: "O" },
  });
  expect(saved.ok()).toBe(true);
  await page.goto("/settings/homebrew");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expectAligned(
    row.getByText("2024", { exact: true }),
    row.getByText("Homebrew", { exact: true }),
  );
});

const fireball = [{ type: "spell", name: "Fireball", source: "PHB", edition: "classic" }];

test("a search result's edition chip lines up with its source chip", async ({ page }) => {
  await page.route(/\/api\/search\?/, (route) =>
    route.fulfill({ json: { items: fireball, total: 1, limit: 20, offset: 0 } }),
  );
  await page.goto("/");
  await page.getByRole("combobox", { name: "Search characters and the compendium" }).fill("fire");
  const option = page.getByRole("option", { name: /Fireball/ });
  await expectAligned(
    option.getByText("2014", { exact: true }),
    option.getByText("PHB", { exact: true }),
  );
});

test("a search page row's edition chip lines up with its source chip", async ({ page }) => {
  await page.route(/\/api\/search\?/, (route) =>
    route.fulfill({ json: { items: fireball, total: 1, limit: 50, offset: 0 } }),
  );
  await page.goto("/search?q=fire");
  const row = page.getByRole("listitem").filter({ hasText: "Fireball" });
  await expectAligned(
    row.getByText("2014", { exact: true }),
    row.getByText("PHB", { exact: true }),
  );
});

test("the character header centers its edition chip on the name", async ({ page, request }) => {
  const id = await createCharacter(request, `Chip Header ${Date.now()}`);
  await page.goto(`/characters/${id}`);
  const header = page.locator("[data-character-header]");
  const chip = await box(chipOf(header.getByText("2024", { exact: true })));
  const name = await box(header.getByRole("heading", { level: 1 }));
  expect(Math.abs(chip.y + chip.height / 2 - (name.y + name.height / 2))).toBeLessThanOrEqual(0.25);
});
