import type { Page } from "@playwright/test";

/**
 * A CSS color as the browser computes it, so an assertion names the Tailwind token or
 * the mix rather than pinning that release's numbers.
 */
export function computedColor(page: Page, color: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.color = value;
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    return computed;
  }, color);
}
