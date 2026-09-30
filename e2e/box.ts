import type { Locator } from "@playwright/test";

/** A laid-out element's bounding box; throws where the element has none. */
export async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("not laid out");
  return b;
}
