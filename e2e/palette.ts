import type { Page } from "@playwright/test";

/**
 * A palette color as the browser computes it, so an assertion names the Tailwind token
 * rather than pinning that release's numbers.
 */
export function computedColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}
