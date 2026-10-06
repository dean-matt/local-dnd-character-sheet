import { expect, test } from "@playwright/test";
import { computedColor } from "./palette";

const light = {
  name: "light",
  ground: "#f4f5f7",
  ink: "#1f2430",
  accent: "#c1272d",
};
const dark = {
  name: "dark",
  ground: "var(--color-gray-900)",
  ink: "var(--color-gray-100)",
  accent: "color-mix(in oklab, #c1272d 90%, white)",
};

const cases = [
  { stored: "light", system: "dark", scheme: "light", palette: light },
  { stored: "dark", system: "light", scheme: "dark", palette: dark },
  { stored: null, system: "dark", scheme: "light dark", palette: dark },
  { stored: null, system: "light", scheme: "light dark", palette: light },
] as const;

for (const { stored, system, scheme, palette } of cases) {
  test(`a ${stored ?? "system"} theme on a ${system} system paints the ${palette.name} palette`, async ({
    page,
  }) => {
    if (stored) await page.addInitScript((theme) => localStorage.setItem("theme", theme), stored);
    await page.emulateMedia({ colorScheme: system });
    await page.goto("/characters");

    // Native controls and scrollbars follow color-scheme, not the tokens.
    await expect(page.locator("html")).toHaveCSS("color-scheme", scheme);
    const body = page.locator("body");
    await expect(body).toHaveCSS("background-color", await computedColor(page, palette.ground));
    await expect(body).toHaveCSS("color", await computedColor(page, palette.ink));
    expect(await computedColor(page, "var(--color-accent)")).toBe(
      await computedColor(page, palette.accent),
    );
  });
}

for (const { system, accent, text } of [
  { system: "light", accent: "#3a4f7a", text: "#3a4f7a" },
  {
    system: "dark",
    accent: "color-mix(in oklab, #3a4f7a, white 21%)",
    text: "color-mix(in oklab, #3a4f7a, white 46%)",
  },
] as const) {
  test(`a chosen accent survives a reload and paints its ${system} shades`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: system });
    await page.goto("/settings");
    await page.getByRole("button", { name: "Blue accent" }).click();
    await page.reload();

    await expect(page.getByRole("button", { name: "Blue accent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const [token, expected] of [
      ["--color-accent", accent],
      ["--color-accent-text", text],
      ["--color-accent-hover", `color-mix(in oklab, ${accent} 85%, black)`],
    ] as const) {
      expect(await computedColor(page, `var(${token})`)).toBe(await computedColor(page, expected));
    }
  });
}
