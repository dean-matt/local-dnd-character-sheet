import { expect, type Page, test } from "@playwright/test";
import { createCharacter } from "./character";

const feat = { name: "Longwinded", source: "XPHB" };

test.beforeEach(async ({ page }) => {
  await page.route("**/api/search?*", (route) =>
    route.fulfill({
      json: { items: [{ type: "feat", ...feat, edition: "one" }], total: 1, limit: 10, offset: 0 },
    }),
  );
  await page.route(`**/api/feats/${feat.name}/${feat.source}`, (route) =>
    route.fulfill({
      json: {
        ...feat,
        edition: "one",
        json: {
          ...feat,
          entries: Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1}.`),
        },
      },
    }),
  );
  await page.route("**/api/refs/resolve", (route) => {
    const { refs } = route.request().postDataJSON() as { refs: unknown[] };
    return route.fulfill({ json: { refs: refs.map(() => null) } });
  });
});

// The ring is the focus outline's width plus its offset, drawn outside the control's box.
// The dialog and every scroller between it and the control must contain it on each axis.
async function clippedRings(page: Page) {
  // A key press makes :focus-visible match for the scripted focus() calls that follow.
  await page.keyboard.press("Shift");
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: page.evaluate serializes one function, so its helpers cannot live outside it.
  return page.evaluate(() => {
    const dialog = document.querySelector("dialog[open]");
    if (!dialog) return { clipped: ["no open dialog"], checked: [] as string[] };
    const out: string[] = [];
    const checked: string[] = [];
    const controls = dialog.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
    );
    for (const el of controls) {
      if (el.matches(":disabled") || !el.getClientRects().length) continue;
      el.focus();
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      const style = getComputedStyle(el);
      // A fixed control draws over the backdrop, outside the dialog's clip.
      if (style.outlineStyle === "none" || style.position === "fixed") continue;
      checked.push(el.tagName.toLowerCase());
      // An inset ring (negative offset) lies inside the box, so only its width can reach out.
      const reach = Math.max(
        0,
        Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset),
      );
      const r = el.getBoundingClientRect();
      for (let a: Element | null = el.parentElement; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        const clipX = s.overflowX !== "visible";
        const clipY = s.overflowY !== "visible";
        if (clipX || clipY) {
          const box = a.getBoundingClientRect();
          const left = box.left + a.clientLeft;
          const top = box.top + a.clientTop;
          const sides: string[] = [];
          if (clipX && r.left - reach < left - 0.5) sides.push("left");
          if (clipX && r.right + reach > left + a.clientWidth + 0.5) sides.push("right");
          if (clipY && r.height + 2 * reach <= a.clientHeight) {
            if (r.top - reach < top - 0.5) sides.push("top");
            if (r.bottom + reach > top + a.clientHeight + 0.5) sides.push("bottom");
          }
          if (sides.length) {
            const name = el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30) ?? "";
            out.push(
              `${el.tagName.toLowerCase()} "${name}" ${sides.join("+")} in <${a.tagName.toLowerCase()}>`,
            );
            break;
          }
        }
        if (a === dialog) break;
      }
    }
    return { clipped: out, checked };
  });
}

for (const width of [1440, 480]) {
  test(`no control in the catalog detail modal has its focus ring clipped at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/characters");
    await page.getByRole("combobox", { name: "Search characters and the compendium" }).fill("long");
    await page.getByRole("option", { name: new RegExp(feat.name) }).click();
    await expect(page.getByRole("dialog", { name: feat.name })).toBeVisible();
    const { clipped, checked } = await clippedRings(page);
    expect(clipped).toEqual([]);
    expect(checked).toContain("section");
  });

  test(`no control in the delete character modal has its focus ring clipped at ${width}px`, async ({
    page,
    request,
  }) => {
    const id = await createCharacter(request, `E2E Ring ${Date.now()}`);
    try {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(`/characters/${id}/settings`);
      await page.getByRole("button", { name: "Delete character" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const { clipped, checked } = await clippedRings(page);
      expect(clipped).toEqual([]);
      expect(checked.length).toBeGreaterThan(0);
    } finally {
      await request.delete(`/api/characters/${id}`);
    }
  });
}
