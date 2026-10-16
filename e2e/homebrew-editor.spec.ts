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
  await page.goto("/settings/homebrew");
  const items = page.getByRole("region", { name: "Items" });
  const add = items.getByRole("button", { name: "Add item" });
  await add.press("Enter");
  const editor = page.getByRole("dialog", { name: "New item" });
  await expect(editor).toBeVisible();
  await expectNoViolations(page);

  const name = editor.getByRole("textbox", { name: "Name" });
  await name.press("ControlOrMeta+a");
  await name.pressSequentially("Lantern Blade");
  const next = editor.getByRole("button", { name: "Next" });
  for (const title of ["Defenses", "Rules text", "Review"]) {
    await next.press("Enter");
    await expect(editor.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(editor.getByRole("heading", { name: "Lantern Blade" })).toBeVisible();
  await expectNoViolations(page);

  await editor.getByRole("tab", { name: "Step by step" }).press("ArrowRight");
  await expect(editor.getByRole("tab", { name: "JSON" })).toBeFocused();
  await expect(editor.getByRole("textbox", { name: "Item JSON" })).toBeVisible();
  await expectNoViolations(page);

  await editor.getByRole("button", { name: "Preview" }).press("Enter");
  await expect(editor.getByRole("heading", { name: "Lantern Blade" })).toBeVisible();
  await editor.getByRole("button", { name: "Back to editing" }).press("Enter");
  await expect(editor.getByRole("textbox", { name: "Item JSON" })).toBeVisible();

  await editor.getByRole("button", { name: "Save" }).press("Enter");
  await expect(editor).toBeHidden();
  await expect(items.getByText("Lantern Blade")).toBeVisible();
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

  const reference = await box(editor.getByRole("region", { name: "Fields the sheet reads" }));
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
