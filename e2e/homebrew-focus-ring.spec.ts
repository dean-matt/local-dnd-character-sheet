import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/refs/resolve", (route) => {
    const { refs } = route.request().postDataJSON() as { refs: unknown[] };
    return route.fulfill({ json: { refs: refs.map(() => null) } });
  });
});

const KINDS = [
  { path: "items", add: "Add item", dialog: "New item" },
  { path: "races", add: "Add race", dialog: "New race" },
  { path: "spells", add: "Add spell", dialog: "New spell" },
  { path: "backgrounds", add: "Add background", dialog: "New background" },
  { path: "classes", add: "Add class", dialog: "New class" },
];

// The ring is the focus outline's width plus its offset, drawn outside the control's box.
// Every ancestor below the dialog that clips on an axis must contain it on that axis.
async function clippedRings(page: Page) {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: page.evaluate serializes one function, so its helpers cannot live outside it.
  return page.evaluate(() => {
    const dialog = document.querySelector("dialog[open]");
    if (!dialog) return ["no open dialog"];
    const out: string[] = [];
    const controls = dialog.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
    );
    for (const el of controls) {
      if (el.matches(":disabled") || !el.getClientRects().length) continue;
      el.focus();
      // Focus leaves a partly visible control where it is; a user scrolls it into view.
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      const style = getComputedStyle(el);
      if (style.outlineStyle === "none") continue;
      const reach = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
      const r = el.getBoundingClientRect();
      for (let a = el.parentElement; a && a !== dialog; a = a.parentElement) {
        const s = getComputedStyle(a);
        const clipX = s.overflowX !== "visible";
        const clipY = s.overflowY !== "visible";
        if (!clipX && !clipY) continue;
        const left = a.getBoundingClientRect().left + a.clientLeft;
        const top = a.getBoundingClientRect().top + a.clientTop;
        const sides: string[] = [];
        if (clipX && r.left - reach < left - 0.5) sides.push("left");
        if (clipX && r.right + reach > left + a.clientWidth + 0.5) sides.push("right");
        // A control taller than its scroller is scrolled, so only its visible edge can be judged.
        if (clipY && r.height + 2 * reach <= a.clientHeight) {
          if (r.top - reach < top - 0.5) sides.push("top");
          if (r.bottom + reach > top + a.clientHeight + 0.5) sides.push("bottom");
        }
        if (sides.length) {
          const name = el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30) ?? "";
          out.push(
            `${el.tagName.toLowerCase()} "${name}" ${sides.join("+")} in <${a.tagName.toLowerCase()} class="${a.className}">`,
          );
          break;
        }
      }
    }
    return out;
  });
}

for (const width of [1440, 480]) {
  for (const { path, add, dialog } of KINDS) {
    test(`no homebrew ${path} editor control has its focus ring clipped at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/homebrew/${path}`);
      await page.getByRole("button", { name: add }).click();
      const editor = page.getByRole("dialog", { name: dialog });
      await expect(editor).toBeVisible();

      const clipped: string[] = [];
      const next = editor.getByRole("button", { name: "Next" });
      for (let step = 1; step <= 8; step++) {
        clipped.push(...(await clippedRings(page)).map((c) => `step ${step}: ${c}`));
        if (!(await next.isVisible())) break;
        await next.click();
      }
      await editor.getByRole("tab", { name: "Preview" }).click();
      clipped.push(...(await clippedRings(page)).map((c) => `preview: ${c}`));
      await editor.getByRole("tab", { name: "JSON" }).click();
      clipped.push(...(await clippedRings(page)).map((c) => `json: ${c}`));
      expect(clipped).toEqual([]);
    });
  }
}
