import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { box } from "./box";

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
  await expect(editor.getByText("Item JSON", { exact: true })).toBeVisible();

  await json.focus();
  await json.press("ControlOrMeta+a");
  await page.keyboard.insertText('{ "name": "Glow", "abil" }');
  for (const _ of '" }') await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Control+Space");
  const suggestions = editor.getByRole("listbox");
  await expect(suggestions.getByRole("option", { name: "ability" })).toBeVisible();
  await expect(editor.locator(".cm-completionInfo")).toContainText("adds 1 to Wisdom");
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
  await expect(hover).toContainText("adds 1 to Wisdom");
  await expect(hover).toContainText("object");
  await expectNoViolations(page);

  await json.press("Tab");
  await expect(json).not.toBeFocused();
  await expect(editor).toBeVisible();
});
