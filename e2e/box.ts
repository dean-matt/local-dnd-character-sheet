import { expect, type Locator, type Page } from "@playwright/test";

/** A laid-out element's bounding box; throws where the element has none. */
export async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("not laid out");
  return b;
}

/** A laid-out element's top and bottom edges. */
export async function edges(locator: Locator) {
  const b = await box(locator);
  return { top: b.y, bottom: b.y + b.height };
}

/** Pads `content` past the viewport, so the test needs no catalog to fill a sheet. */
export async function scrollToBottom(page: Page, content: Locator) {
  await content.evaluate((element) => {
    const spacer = document.createElement("div");
    spacer.style.height = "3000px";
    element.append(spacer);
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}
