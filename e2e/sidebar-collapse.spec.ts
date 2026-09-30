import { expect, type Locator, test } from "@playwright/test";

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("not laid out");
  return b;
}

const centerX = (b: { x: number; width: number }) => b.x + b.width / 2;

test("the collapse button lines up with the page rows, expanded and collapsed", async ({
  page,
}) => {
  // Without transitions the collapsed rail is measured at its final width, not mid-animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/settings");
  await page.evaluate(() => localStorage.removeItem("sidebar-collapsed"));
  await page.reload();
  const row = page.getByRole("navigation", { name: "Settings sections" }).getByRole("link").first();
  const collapse = page.getByRole("button", { name: "Collapse sidebar" });

  const rowBox = await box(row);
  const buttonBox = await box(collapse);
  expect(buttonBox.x).toBe(rowBox.x);
  expect(buttonBox.width).toBe(rowBox.width);
  expect(buttonBox.height).toBe(rowBox.height);
  expect(centerX(await box(collapse.locator("svg")))).toBeCloseTo(
    centerX(await box(row.locator("svg"))),
  );
  expect((await box(collapse.locator("span"))).x).toBeCloseTo((await box(row.locator("span"))).x);

  await collapse.click();
  const expand = page.getByRole("button", { name: "Expand sidebar" });
  expect((await box(expand)).width).toBe((await box(row)).width);
  expect(centerX(await box(expand.locator("svg")))).toBeCloseTo(
    centerX(await box(row.locator("svg"))),
  );
});
