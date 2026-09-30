import { expect, type Locator, type Page, test } from "@playwright/test";
import { box } from "./box";

async function edges(locator: Locator) {
  const b = await box(locator);
  return { top: b.y, bottom: b.y + b.height };
}

/** Pads `content` past the viewport, so the test needs no catalog to fill a sheet. */
async function scrollToBottom(page: Page, content: Locator) {
  await content.evaluate((element) => {
    const spacer = document.createElement("div");
    spacer.style.height = "3000px";
    element.append(spacer);
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}

test("the top bar, character header and sidebar stay pinned in a tall window, the header on one line, and focus lands below them", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/characters", {
    data: {
      // Longer than any window is wide, so it wraps a name that can wrap and squeezes the
      // subtitle to its 160px floor, narrower than the subtitle this character reads.
      name: `E2E Pinned ${Date.now()}${" of the Silverwood".repeat(8)}`,
      edition: "one",
      levels: [{ class: { name: "Warlock", source: "XPHB" } }],
      race: { name: "Half-Elf", source: "XPHB" },
      background: { name: "Charlatan", source: "XPHB" },
      abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
      proficiencies: {
        savingThrows: [],
        skills: [],
        armor: [],
        weapons: [],
        tools: [],
        languages: [],
      },
      inventory: [],
      spells: [],
    },
  });
  expect(response.ok()).toBe(true);
  const { id } = await response.json();

  try {
    await page.goto(`/characters/${id}/p/stats`);
    const bar = page.getByRole("banner");
    const header = page.locator("[data-character-header]");
    const rail = page.locator("aside");
    await expect(header).toBeVisible();
    const lines = await header
      .locator("h1, p")
      .evaluateAll((elements) =>
        elements.map((e) =>
          Math.round(e.clientHeight / Number.parseFloat(getComputedStyle(e).lineHeight)),
        ),
      );
    expect(lines).toEqual([1, 1]);

    const content = header.locator("xpath=following-sibling::div");
    await content.evaluate((element) => {
      const probe = document.createElement("button");
      probe.textContent = "Probe";
      element.prepend(probe);
    });
    await scrollToBottom(page, content);
    const barBox = await edges(bar);
    const headerBox = await edges(header);
    expect(barBox.top).toBe(0);
    expect(headerBox.top).toBe(barBox.bottom);
    expect((await edges(rail)).top).toBe(barBox.bottom);

    // Chrome centers a focus target that sits off screen, so the probe starts on screen and
    // under the header, where only `scroll-padding-top` tells focus to move it.
    const probe = page.getByRole("button", { name: "Probe" });
    await probe.evaluate((element, y) => {
      window.scrollBy(0, element.getBoundingClientRect().top - y);
    }, barBox.bottom + 10);
    expect((await edges(probe)).bottom).toBeLessThanOrEqual((await edges(header)).bottom);
    await probe.focus();
    expect((await edges(probe)).top).toBeGreaterThanOrEqual(headerBox.bottom);

    await page.getByRole("button", { name: "Character" }).click();
    const covering = await page.evaluate(
      (y) => document.elementFromPoint(window.innerWidth - 20, y)?.closest("header") !== null,
      headerBox.top + 10,
    );
    expect(covering).toBe(true);

    // Below the `tall` variant's 36rem the header scrolls away and the top bar stays.
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(async () => (await edges(header)).bottom).toBeLessThan(0);
    expect((await edges(bar)).top).toBe(0);

    // A client-side navigation, so only the header's unmount clears its padding.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator("html")).toHaveCSS("scroll-padding-top", "64px");
    await scrollToBottom(page, page.locator("main"));
    expect((await edges(bar)).top).toBe(0);
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});
