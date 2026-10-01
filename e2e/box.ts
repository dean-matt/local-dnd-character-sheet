import type { Locator } from "@playwright/test";

export async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("not laid out");
  return b;
}

export async function edges(locator: Locator) {
  const b = await box(locator);
  return { top: b.y, bottom: b.y + b.height };
}
