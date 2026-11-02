import { expect, test } from "@playwright/test";
import { createCharacter } from "./character";

const entries = Array.from({ length: 14 }, (_, index) => ({
  id: 14 - index,
  describedAs: `Changed field ${index + 1}`,
  changes: ["One change"],
  changedAt: "2026-01-01T12:00:00.000Z",
}));

for (const width of [1440, 480]) {
  test(`no undo history row has its focus ring clipped at ${width}px`, async ({
    page,
    request,
  }) => {
    const id = await createCharacter(request, `E2E Undo Ring ${Date.now()}`);
    try {
      await page.route(`**/api/characters/${id}/undo`, (route) => route.fulfill({ json: entries }));
      await page.setViewportSize({ width, height: 700 });
      await page.goto(`/characters/${id}`);
      await page.getByRole("button", { name: "Undo Changes" }).click();
      const rows = page.getByRole("listitem").filter({ hasText: /^Changed field/ });
      await expect(rows).toHaveCount(entries.length);
      const list = page.locator("ol").filter({ has: rows.first() });

      // A key press makes :focus-visible match for the scripted focus() calls that follow.
      await page.keyboard.press("Shift");
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: list.evaluate serializes one function, so its helpers cannot live outside it.
      const clipped = await list.evaluate((ol) => {
        const out: string[] = [];
        for (const row of ol.querySelectorAll<HTMLElement>(":scope > li")) {
          row.querySelector<HTMLElement>("button")?.focus();
          row.scrollIntoView({ block: "nearest" });
          // Scrolling a row into view can shift the list itself, so its box is read afterwards.
          const box = ol.getBoundingClientRect();
          const left = box.left + ol.clientLeft;
          const top = box.top + ol.clientTop;
          const style = getComputedStyle(row);
          const reach =
            Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
          const r = row.getBoundingClientRect();
          const sides: string[] = [];
          if (r.left - reach < left - 0.5) sides.push("left");
          if (r.right + reach > left + ol.clientWidth + 0.5) sides.push("right");
          if (r.top - reach < top - 0.5) sides.push("top");
          if (r.bottom + reach > top + ol.clientHeight + 0.5) sides.push("bottom");
          if (sides.length) out.push(`${row.textContent?.slice(0, 20)} ${sides.join("+")}`);
        }
        return out;
      });
      expect(clipped).toEqual([]);
    } finally {
      await request.delete(`/api/characters/${id}`);
    }
  });
}
