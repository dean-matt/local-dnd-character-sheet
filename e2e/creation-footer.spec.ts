import { expect, type Page, test } from "@playwright/test";
import { edges } from "./box";
import { scrollToBottom } from "./character";

async function pinned(page: Page, height: number) {
  const footer = page.locator("[data-creation-footer]");
  const content = footer.locator("xpath=preceding-sibling::div");
  await scrollToBottom(page, content);
  const barBox = await edges(page.getByRole("banner"));
  expect(barBox.top).toBe(0);
  expect((await edges(page.locator("aside"))).top).toBe(barBox.bottom);
  const footerBox = await edges(footer);
  expect(footerBox.bottom).toBe(height);
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
  return { content, footerBox };
}

test("creation's Cancel, Back and Next stay pinned at the window's foot while the step scrolls, and focus lands above them", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/characters/new");
  await page.evaluate(() => localStorage.removeItem("sidebar-collapsed"));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Identity" })).toBeVisible();

  const { content, footerBox } = await pinned(page, 720);

  // Chrome centers a focus target that sits off screen, so the probe starts on screen and
  // under the footer, where only `scroll-padding-bottom` tells focus to move it.
  await content.evaluate((element) => {
    const probe = document.createElement("button");
    probe.textContent = "Probe";
    probe.style.marginTop = "1000px";
    element.prepend(probe);
  });
  const probe = page.getByRole("button", { name: "Probe" });
  await probe.evaluate((element, y) => {
    window.scrollBy(0, element.getBoundingClientRect().bottom - y);
  }, footerBox.bottom - 10);
  expect((await edges(probe)).top).toBeGreaterThanOrEqual(footerBox.top);
  await probe.focus();
  expect((await edges(probe)).bottom).toBeLessThanOrEqual(footerBox.top);

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await pinned(page, 844);
});
