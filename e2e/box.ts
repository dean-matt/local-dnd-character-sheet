import type { Locator } from "@playwright/test";

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
