import { type APIRequestContext, expect, type Locator, type Page, test } from "@playwright/test";
import { box } from "./box";
import { createCharacter } from "./character";

const feat = { name: "Longwinded", source: "XPHB" };
const fireball = { name: "Fireball", source: "XPHB" };

// CI runs with no content.db, so the catalog this test reads is stubbed at the network.
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
          entries: [
            ...Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1}.`),
            `The last line names {@spell ${fireball.name}|${fireball.source}}.`,
          ],
        },
      },
    }),
  );
  await page.route("**/api/refs/resolve", (route) => {
    const { refs } = route.request().postDataJSON() as { refs: unknown[] };
    const row = { ...fireball, entries: ["A bright streak."], path: "/spells/Fireball/XPHB" };
    return route.fulfill({ json: { refs: refs.map(() => row) } });
  });
  await page.route(`**/api/spells/${fireball.name}/${fireball.source}`, (route) => {
    const spell = { ...fireball, level: 3, school: "V" };
    return route.fulfill({
      json: {
        ...spell,
        edition: "one",
        concentration: false,
        ritual: false,
        json: { ...spell, duration: [{ type: "instant" }], entries: ["A bright streak."] },
      },
    });
  });
});

let character: string | undefined;

// Here rather than in a `finally`, which a timed-out test reaches only after its request context closed.
test.afterEach(async ({ request }) => {
  if (character) await request.delete(`/api/characters/${character}`);
  character = undefined;
});

/** A character whose first page holds one rules reference, so the sheet behind a modal has a popover. */
async function sheetWithReference(request: APIRequestContext) {
  const id = await createCharacter(request, `E2E Popover ${Date.now()}`);
  character = id;
  const pages = (await (await request.get(`/api/characters/${id}/pages`)).json()) as {
    preset: boolean;
    blocks: unknown[];
  }[];
  const text = `See {@spell ${fireball.name}|${fireball.source}}.`;
  const response = await request.put(`/api/characters/${id}/pages`, {
    data: pages.map(({ preset: _, ...rest }, index) =>
      index === 0 ? { ...rest, blocks: [{ kind: "text", text }] } : rest,
    ),
  });
  expect(response.ok()).toBe(true);
  return id;
}

/** What the page draws at `point`: the dialog, its backdrop counting as the dialog, or else what sits under it. */
function hitAt(page: Page, point: { x: number; y: number }) {
  return page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    if (hit?.closest("dialog")) return "dialog";
    return hit?.closest('[role="group"]') ? "popover" : "page";
  }, point);
}

/** Records whether the trigger ever reports itself open, so a popover that opens and closes between checks still counts. */
async function watchOpened(trigger: Locator) {
  await trigger.evaluate((element) => {
    const record = element as HTMLElement & { everOpened?: boolean };
    record.everOpened = false;
    new MutationObserver(() => {
      if (element.getAttribute("aria-expanded") === "true") record.everOpened = true;
    }).observe(element, { attributes: true });
  });
  return () =>
    trigger.evaluate((element) => (element as HTMLElement & { everOpened?: boolean }).everOpened);
}

/** Two frames, so a render that a pointer event scheduled has landed before a check reads the page. */
const settled = (page: Page) =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

test("a popover opened at the bottom of a modal draws past the modal's edge, follows its trigger and closes before the modal", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/characters");
  await page.getByRole("combobox", { name: "Search characters and the compendium" }).fill("long");
  await page.getByRole("option", { name: new RegExp(feat.name) }).click();

  const dialog = page.getByRole("dialog", { name: feat.name });
  const body = dialog.getByRole("region", { name: feat.name });
  const trigger = dialog.getByRole("button", { name: fireball.name, exact: true });
  await expect(trigger).toBeVisible();
  // Short of the end, so the scroll below moves the trigger up and leaves room under it.
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight - element.clientHeight - 40;
  });
  await trigger.click();

  const content = page.getByRole("group", { name: `${fireball.name} (${fireball.source})` });
  await expect(content).toBeVisible();
  const dialogBox = await box(dialog);
  const contentBox = await box(content);
  const below = contentBox.y + contentBox.height - 2;
  expect(below).toBeGreaterThan(dialogBox.y + dialogBox.height);
  // Hit-tested where the modal's scroll container would have clipped it.
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('[role="group"]')?.ariaLabel,
    [contentBox.x + 4, below] as const,
  );
  expect(hit).toBe(`${fireball.name} (${fireball.source})`);

  const gap = async () => (await box(content)).y - (await box(trigger)).y;
  const before = await gap();
  await body.evaluate((element) => {
    element.scrollTop += 40;
  });
  await expect.poll(gap).toBeCloseTo(before, 0);

  await page.keyboard.press("Tab");
  await expect(content.getByRole("button", { name: `Open ${fireball.name}` })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(content).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeFocused();
});

test("while a modal is open, hovering or focusing a reference on the page behind it opens no popover", async ({
  page,
  request,
}) => {
  const id = await sheetWithReference(request);
  await page.goto(`/characters/${id}/p/stats`);
  const trigger = page.locator("main").getByRole("button", { name: fireball.name, exact: true });
  await expect(trigger).toBeVisible();
  await page.getByRole("combobox", { name: "Search characters and the compendium" }).fill("long");
  await page.getByRole("option", { name: new RegExp(feat.name) }).click();
  const dialog = page.getByRole("dialog", { name: feat.name });
  await expect(dialog).toBeVisible();

  const opened = await watchOpened(trigger);
  await trigger.scrollIntoViewIfNeeded();
  const at = await box(trigger);
  const onTrigger = { x: at.x + at.width / 2, y: at.y + at.height / 2 };
  await page.mouse.move(onTrigger.x, onTrigger.y, { steps: 4 });
  await settled(page);
  expect(await hitAt(page, onTrigger)).toBe("dialog");
  expect(await opened()).toBe(false);

  await trigger.evaluate((element) => (element as HTMLElement).focus());
  await expect(trigger).not.toBeFocused();
  for (const key of [...Array(4).fill("Tab"), ...Array(4).fill("Shift+Tab")]) {
    await page.keyboard.press(key);
    expect(await page.evaluate(() => document.activeElement?.closest("main") === null)).toBe(true);
  }
  expect(await opened()).toBe(false);
  await expect(dialog).toBeVisible();
});

test("a popover pinned on the page closes under the modal it opens, and the page takes it back when the modal closes", async ({
  page,
  request,
}) => {
  const id = await sheetWithReference(request);
  await page.goto(`/characters/${id}/p/stats`);
  const trigger = page.locator("main").getByRole("button", { name: fireball.name, exact: true });
  const content = page
    .locator("main")
    .getByRole("group", { name: `${fireball.name} (${fireball.source})` });
  await trigger.click();
  await expect(content).toBeVisible();
  const pinned = await box(content);
  await content.getByRole("button", { name: `Open ${fireball.name}` }).click();

  const dialog = page.getByRole("dialog", { name: fireball.name });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  expect(await hitAt(page, { x: pinned.x + 4, y: pinned.y + 4 })).toBe("dialog");
  expect(
    await hitAt(page, { x: pinned.x + pinned.width - 4, y: pinned.y + pinned.height - 4 }),
  ).toBe("dialog");
  await expect(content).toBeHidden();
  await trigger.evaluate((element) => (element as HTMLElement).focus());
  await expect(trigger).not.toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(content).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(content).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(content).toBeVisible();
  expect(await hitAt(page, { x: pinned.x + 4, y: pinned.y + 4 })).toBe("popover");
});

test("the page behind an open modal does not scroll, and the modal opens wide", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/characters");
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "3000px";
    document.body.append(spacer);
  });
  await page.mouse.move(20, 300);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.getByRole("combobox", { name: "Search characters and the compendium" }).fill("long");
  await page.getByRole("option", { name: new RegExp(feat.name) }).click();
  const dialog = page.getByRole("dialog", { name: feat.name });
  await expect(dialog).toBeVisible();
  expect((await box(dialog)).width).toBe(768);

  await page.mouse.move(20, 300);
  await page.mouse.wheel(0, 600);
  await settled(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
