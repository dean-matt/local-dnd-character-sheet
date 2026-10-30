import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { derivedRecord } from "../packages/web/src/test/records.ts";
import { box } from "./box";
import { createCharacter } from "./character";

// CI runs with no content.db, so the references a preview resolves are stubbed at the network.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/refs/resolve", (route) => {
    const { refs } = route.request().postDataJSON() as { refs: unknown[] };
    return route.fulfill({ json: { refs: refs.map(() => null) } });
  });
});

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.length}`)).toEqual([]);
}

test("a keyboard user adds a homebrew item step by step, switches to JSON, previews and saves it", async ({
  page,
}) => {
  // CI retries on the same homebrew.db, where a first attempt's save would hold the name.
  const named = `Lantern Blade ${test.info().retry + 1}`;
  await page.goto("/settings/homebrew");
  const items = page.getByRole("region", { name: "Items" });
  const add = items.getByRole("button", { name: "Add item" });
  await add.press("Enter");
  const editor = page.getByRole("dialog", { name: "New item" });
  await expect(editor).toBeVisible();
  await expectNoViolations(page);

  const name = editor.getByRole("textbox", { name: "Name" });
  await name.press("ControlOrMeta+a");
  await name.pressSequentially(named);
  await name.press("Enter");
  await expect(editor.getByRole("heading", { name: "Combat" })).toBeVisible();
  await expect(editor.getByRole("heading", { name: "Defenses" })).toBeVisible();

  const next = editor.getByRole("button", { name: "Next" });
  await editor.getByRole("button", { name: "Close" }).focus();
  for (
    let presses = 0;
    presses < 80 && !(await next.evaluate((n) => n === document.activeElement));
    presses++
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(editor.getByRole("heading", { name: "Magic" })).toBeVisible();
  await expect(editor.getByRole("heading", { name: "Effects" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(editor.getByRole("tab", { name: "Preview" })).toBeFocused();
  await expect(editor.getByRole("heading", { name: named })).toBeVisible();
  await expectNoViolations(page);

  await page.keyboard.press("ArrowLeft");
  await expect(editor.getByRole("tab", { name: "JSON" })).toBeFocused();
  await expect(editor.getByRole("textbox", { name: "Item JSON" })).toBeVisible();
  await expectNoViolations(page);

  await editor.getByRole("tab", { name: "JSON" }).press("ArrowRight");
  await expect(editor.getByRole("tab", { name: "Preview" })).toBeFocused();
  await expect(editor.getByRole("heading", { name: named })).toBeVisible();
  await editor.getByRole("tab", { name: "Preview" }).press("ArrowLeft");
  await expect(editor.getByRole("textbox", { name: "Item JSON" })).toBeVisible();

  await editor.getByRole("button", { name: "Save" }).press("Enter");
  await expect(editor).toBeHidden();
  await expect(items.getByText(named)).toBeVisible();
  await expect(add).toBeFocused();
});

test("a keyboard user sets a homebrew feat's choice on each step, which holds no violation", async ({
  page,
}) => {
  await page.goto("/settings/homebrew");
  await page.getByRole("button", { name: "Add feat" }).click();
  const editor = page.getByRole("dialog", { name: "New feat" });
  await expect(editor.getByRole("textbox", { name: "Name" })).toBeVisible();
  await expectNoViolations(page);

  await editor.getByRole("button", { name: "Prerequisites & Ability scores" }).click();
  const saves = editor.getByRole("group", { name: "Saving throws" });
  const granted = saves.getByRole("combobox", { name: "Granted as" });
  await granted.press("Enter");
  await granted.press("ArrowDown");
  await granted.press("ArrowDown");
  await granted.press("Enter");
  await expect(granted).toHaveText("Choice from a list");
  await saves.getByRole("button", { name: /^Choose from/ }).press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await expect(saves.getByRole("button", { name: /^Choose from/ })).toHaveAccessibleName(
    "Choose from Strength",
  );
  await expectNoViolations(page);

  await editor.getByRole("button", { name: "Proficiencies" }).click();
  await expect(editor.getByRole("group", { name: "Languages" })).toBeVisible();
  await expectNoViolations(page);
});

test("at phone width the field reference stacks above the JSON, and the editor fits the window", async ({
  page,
}) => {
  const width = 390;
  await page.setViewportSize({ width, height: 800 });
  await page.goto("/settings/homebrew");
  await page.getByRole("button", { name: "Add item" }).click();
  const editor = page.getByRole("dialog", { name: "New item" });
  await editor.getByRole("tab", { name: "JSON" }).click();

  const reference = await box(editor.getByRole("region", { name: "Field Reference" }));
  const json = await box(editor.getByRole("textbox", { name: "Item JSON" }));
  expect(reference.y + reference.height).toBeLessThanOrEqual(json.y);
  const dialog = await box(editor);
  expect(dialog.x + dialog.width).toBeLessThanOrEqual(width);
  expect(
    await editor.evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
});

test("the item JSON editor suggests, describes and marks the fields the sheet applies, and a keyboard user leaves it", async ({
  page,
}) => {
  await page.goto("/settings/homebrew");
  await page.getByRole("button", { name: "Add item" }).click();
  const editor = page.getByRole("dialog", { name: "New item" });
  await editor.getByRole("tab", { name: "JSON" }).click();
  const json = editor.getByRole("textbox", { name: "Item JSON" });
  await editor.getByText("Item JSON", { exact: true }).click();
  await expect(json).toBeFocused();
  await json.press("ControlOrMeta+a");
  await page.keyboard.insertText('{ "name": "Glow", "abil" }');
  for (const _ of '" }') await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Control+Space");
  const suggestions = editor.getByRole("listbox");
  await expect(suggestions.getByRole("option", { name: "ability" })).toBeVisible();
  await expect(editor.locator(".cm-completionInfo")).toContainText('{"wis": 1} adds 1 to Wisdom');
  await page.keyboard.press("Escape");
  await expect(suggestions).toBeHidden();
  await expect(editor).toBeVisible();

  await json.press("ControlOrMeta+a");
  await page.keyboard.insertText('{ "name": "Glow", "ability": { "wis": "+1" } }');
  await expect(editor.locator(".cm-lintRange-error")).toBeVisible();
  const key = await json.evaluate((content) => {
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const at = node.textContent?.indexOf("ability") ?? -1;
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + "ability".length);
      const { x, y, width, height } = range.getBoundingClientRect();
      return { x: x + width / 2, y: y + height / 2 };
    }
    throw new Error("no ability key");
  });
  await page.mouse.move(key.x, key.y);
  const hover = editor.locator(".cm-tooltip-hover");
  await expect(hover).toContainText('{"wis": 1} adds 1 to Wisdom');
  await expect(hover).toContainText("object");
  await expectNoViolations(page);

  await json.press("ControlOrMeta+End");
  const before = await json.textContent();
  await json.press("Tab");
  await expect(json).toBeFocused();
  expect(await json.textContent()).toBe(`${before}  `);
  await json.press("Escape");
  await json.press("Tab");
  await expect(json).not.toBeFocused();
  await expect(editor).toBeVisible();
});

/** A token's color as the page computes it, to compare with an element's own. */
const tokenColor = (page: Page, property: "color" | "backgroundColor", token: string) =>
  page.evaluate(
    ([property, token]) => {
      const probe = document.createElement("i");
      probe.style[property] = `var(${token})`;
      document.body.append(probe);
      const color = getComputedStyle(probe)[property];
      probe.remove();
      return color;
    },
    [property, token] as const,
  );

test("in the dark theme the JSON editor's text, caret and search panel take the theme's tokens", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings/homebrew");
  await page.getByRole("button", { name: "Add item" }).click();
  const editor = page.getByRole("dialog", { name: "New item" });
  await editor.getByRole("tab", { name: "JSON" }).click();
  const json = editor.getByRole("textbox", { name: "Item JSON" });
  await json.focus();
  const caret = await editor
    .locator(".cm-cursor")
    .first()
    .evaluate((cursor) => getComputedStyle(cursor).borderLeftColor);
  expect(caret).toBe(await tokenColor(page, "color", "--color-ink"));

  await page.keyboard.press("ControlOrMeta+f");
  await expect(editor.getByRole("textbox", { name: "Find" })).toBeFocused();
  const panel = await editor
    .locator(".cm-panels")
    .evaluate((panels) => getComputedStyle(panels).backgroundColor);
  expect(panel).toBe(await tokenColor(page, "backgroundColor", "--color-subtle"));
  await expectNoViolations(page);
});

test("a keyboard user edits a homebrew item from a sheet's inventory, and focus returns to Edit", async ({
  page,
  request,
}) => {
  const named = `Sheet Lantern ${test.info().retry + 1} ${Date.now()}`;
  const created = await request.post("/api/homebrew/items", {
    data: { name: named, edition: "one", entries: ["It glows."] },
  });
  expect(created.ok()).toBe(true);
  const itemId = (await created.json()).id as string;
  const id = await createCharacter(request, `E2E Sheet Edit ${Date.now()}`);
  try {
    // CI runs with no content.db, so the derived block and the inventory are stubbed, the
    // inventory naming the homebrew row as the API stores it.
    await page.route(`**/api/characters/${id}/derived`, (route) =>
      route.fulfill({ json: derivedRecord() }),
    );
    await page.route(`**/api/characters/${id}/inventory`, async (route) => {
      const row = await (await page.request.get(`/api/homebrew/items/${itemId}`)).json();
      await route.fulfill({
        json: {
          items: [
            {
              resolved: true,
              name: row.name,
              homebrewId: itemId,
              quantity: 1,
              carried: true,
              equipped: false,
              attuned: false,
              type: null,
              rarity: null,
              value: null,
              estimate: null,
              weapon: null,
              armor: null,
              offers: { abilities: null, proficiency: false, language: false },
              entries: row.json.entries ?? [],
              requiresAttunement: false,
              weight: null,
            },
          ],
        },
      });
    });
    await page.goto(`/characters/${id}/p/inventory`);

    // Focused by locator: where a first Tab lands depends on the route-change focus's timing.
    await page.getByRole("button", { name: named, exact: true }).focus();
    await page.keyboard.press("Enter");
    const detail = page.getByRole("dialog", { name: named, exact: true });
    const edit = detail.getByRole("button", { name: "Edit" });
    await expect(edit).toBeVisible();
    await tabTo(page, edit);
    await expectNoViolations(page);

    await page.keyboard.press("Enter");
    const editor = page.getByRole("dialog", { name: `Edit ${named}` });
    await expect(editor.getByRole("button", { name: "Close" })).toBeFocused();
    await expectNoViolations(page);
    // Past the last control a modal dialog hands focus to the browser, which reads as the body.
    // Nothing else on the page, the detail beneath included, ever takes it.
    for (let presses = 0; presses < 40; presses++) {
      await page.keyboard.press("Tab");
      const held = await editor.evaluate(
        (dialog) =>
          document.activeElement === document.body || dialog.contains(document.activeElement),
      );
      expect(held).toBe(true);
    }

    const name = editor.getByRole("textbox", { name: "Name" });
    await tabTo(page, name);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(`${named} II`);
    await tabTo(page, editor.getByRole("button", { name: "Save" }));
    await page.keyboard.press("Enter");

    await expect(editor).toBeHidden();
    const renamed = page.getByRole("dialog", { name: `${named} II`, exact: true });
    await expect(renamed).toBeVisible();
    await expect(renamed.getByRole("button", { name: "Edit" })).toBeFocused();
  } finally {
    await request.delete(`/api/characters/${id}`);
    await request.delete(`/api/homebrew/items/${itemId}`);
  }
});

/** Presses Tab until `target` holds focus, failing past a bound so a missing target cannot hang. */
async function tabTo(page: Page, target: ReturnType<Page["locator"]>) {
  for (
    let presses = 0;
    presses < 80 && !(await target.evaluate((node) => node === document.activeElement));
    presses++
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test("in a window 600px high the editor's body never scrolls and its footer stays in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/settings/homebrew");
  await page.getByRole("button", { name: "Add item" }).click();
  const editor = page.getByRole("dialog", { name: "New item" });
  await expect(editor).toBeVisible();
  const body = editor.locator("section[aria-labelledby]").first();
  const save = editor.getByRole("button", { name: "Save" });

  const expectBodyFixed = async () => {
    await expect(save).toBeInViewport();
    expect(await body.evaluate((n) => n.scrollHeight <= n.clientHeight)).toBe(true);
  };

  await expectBodyFixed();
  await editor.getByRole("button", { name: "Next" }).click();
  await expectBodyFixed();
  await editor.getByRole("tab", { name: "JSON" }).click();
  await expect(editor.getByRole("textbox", { name: "Item JSON" })).toBeVisible();
  await expectBodyFixed();
  await editor.getByRole("tab", { name: "Preview" }).click();
  await expect(editor.getByRole("region", { name: "Item preview" })).toBeVisible();
  await expectBodyFixed();
});
