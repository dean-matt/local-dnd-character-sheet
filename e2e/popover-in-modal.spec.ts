import { expect, test } from "@playwright/test";
import { box } from "./box";

const feat = { name: "Longwinded", source: "XPHB" };
const fireball = { name: "Fireball", source: "XPHB" };

// CI runs with no content.db, so the catalog this test reads is stubbed at the network.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/search?*", (route) =>
    route.fulfill({
      json: { items: [{ type: "feat", ...feat, edition: "one" }], total: 1, limit: 10, offset: 0 },
    }),
  );
  await page.route(`**/api/feats/${feat.name}/${feat.source}`, (route) =>
    route.fulfill({
      json: {
        ...feat,
        edition: "one",
        json: {
          ...feat,
          entries: [
            ...Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1}.`),
            `The last line names {@spell ${fireball.name}|${fireball.source}}.`,
          ],
        },
      },
    }),
  );
  await page.route("**/api/refs/resolve", (route) => {
    const { refs } = route.request().postDataJSON() as { refs: unknown[] };
    const row = { ...fireball, entries: ["A bright streak."], path: "/spells/Fireball/XPHB" };
    return route.fulfill({ json: { refs: refs.map(() => row) } });
  });
});

test("a popover opened at the bottom of a modal draws past the modal's edge, follows its trigger and closes before the modal", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/characters");
  await page.getByRole("combobox", { name: "Search characters and the compendium" }).fill("long");
  await page.getByRole("option", { name: new RegExp(feat.name) }).click();

  const dialog = page.getByRole("dialog", { name: feat.name });
  const body = dialog.locator("> div");
  const trigger = dialog.getByRole("button", { name: fireball.name, exact: true });
  await expect(trigger).toBeVisible();
  // Short of the end, so the scroll below moves the trigger up and leaves room under it.
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight - element.clientHeight - 40;
  });
  await trigger.click();

  const content = page.getByRole("group", { name: `${fireball.name} (${fireball.source})` });
  await expect(content).toBeVisible();
  const dialogBox = await box(dialog);
  const contentBox = await box(content);
  const below = contentBox.y + contentBox.height - 2;
  expect(below).toBeGreaterThan(dialogBox.y + dialogBox.height);
  // Hit-tested where the modal's scroll container would have clipped it.
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('[role="group"]')?.ariaLabel,
    [contentBox.x + 4, below] as const,
  );
  expect(hit).toBe(`${fireball.name} (${fireball.source})`);

  const gap = async () => (await box(content)).y - (await box(trigger)).y;
  const before = await gap();
  await body.evaluate((element) => {
    element.scrollTop += 40;
  });
  await expect.poll(gap).toBeCloseTo(before, 0);

  await page.keyboard.press("Tab");
  await expect(content.getByRole("button", { name: `Open ${fireball.name}` })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(content).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeFocused();
});
