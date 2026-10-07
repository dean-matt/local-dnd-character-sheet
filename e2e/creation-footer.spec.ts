import { expect, type Page, test } from "@playwright/test";
import { edges } from "./box";
import { scrollToBottom } from "./character";

async function pinned(page: Page, height: number) {
  const footer = page.locator("[data-creation-footer]");
  const content = page.locator("[data-creation-step]");
  await scrollToBottom(page, content);
  const barBox = await edges(page.getByRole("banner"));
  expect(barBox.top).toBe(0);
  // A wrapped footer's height lands on a half pixel, and scrolling stops on a whole one.
  const near = (actual: number, expected: number) =>
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5);
  near((await edges(page.locator("aside"))).top, barBox.bottom);
  const footerBox = await edges(footer);
  near(footerBox.bottom, height);
  const right = await footer.evaluate((element) => element.getBoundingClientRect().right);
  for (const name of ["Cancel", "Back", /^Next/]) {
    const button = footer.getByRole("button", { name });
    const b = await edges(button);
    expect(b.top).toBeGreaterThanOrEqual(footerBox.top);
    expect(b.bottom).toBeLessThanOrEqual(footerBox.bottom);
    expect(
      await button.evaluate((element) => element.getBoundingClientRect().right),
    ).toBeLessThanOrEqual(right);
  }
  expect((await edges(content.locator("> :last-child"))).bottom).toBeLessThanOrEqual(footerBox.top);
  return footerBox;
}

/**
 * Chrome centers a focus target that sits wholly outside the padded viewport, so the probe
 * starts just above the footer's top edge and mostly under it. Focus then aligns its bottom
 * with the padding, and only a padding as tall as the footer clears it.
 */
async function focusClears(page: Page, footerBox: { top: number; bottom: number }) {
  await page.locator("[data-creation-step]").evaluate((element) => {
    const probe = document.createElement("button");
    probe.textContent = "Probe";
    probe.style.marginTop = "1000px";
    element.prepend(probe);
  });
  const probe = page.getByRole("button", { name: "Probe" });
  await probe.evaluate((element, y) => {
    window.scrollBy(0, element.getBoundingClientRect().top - y);
  }, footerBox.top - 4);
  expect((await edges(probe)).bottom).toBeGreaterThan(footerBox.top);
  await probe.focus();
  expect((await edges(probe)).bottom).toBeLessThanOrEqual(footerBox.top);
  await probe.evaluate((element) => element.remove());
}

test("creation's Cancel, Back and Next stay pinned at the window's foot in a tall window while the step scrolls, and focus lands above them", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/characters/new");
  await page.evaluate(() => localStorage.removeItem("sidebar-collapsed"));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Identity" })).toBeVisible();
  const wide = await pinned(page, 720);
  await focusClears(page, wide);

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await pinned(page, 844);
  // Wrapped to a second row, so a fixed height would fall short.
  expect(narrow.bottom - narrow.top).toBeGreaterThan(wide.bottom - wide.top);
  await focusClears(page, narrow);

  // Below the `tall` variant's 36rem the footer scrolls with the step.
  await page.setViewportSize({ width: 1280, height: 240 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(async () => (await edges(page.locator("[data-creation-footer]"))).top)
    .toBeGreaterThan(240);
});
