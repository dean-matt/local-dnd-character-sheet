import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";

/**
 * The theme override only avoids a flash of the wrong theme if the inline
 * script in index.html runs, and sets `data-theme`, before the stylesheet
 * paints. That ordering is a property of the built HTML, not of theme.ts's
 * logic, so it needs its own check against a real build rather than jsdom.
 */
describe("the built page", () => {
  const root = resolve(import.meta.dirname, "..");
  const outDir = mkdtempSync(join(tmpdir(), "web-build-"));

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it("sets the stored theme override before the stylesheet loads", async () => {
    await build({ root, logLevel: "silent", build: { outDir, emptyOutDir: true } });
    const html = readFileSync(join(outDir, "index.html"), "utf8");

    const scriptIndex = html.indexOf('localStorage.getItem("theme")');
    const stylesheetIndex = html.indexOf('rel="stylesheet"');

    expect(scriptIndex).toBeGreaterThan(-1);
    expect(stylesheetIndex).toBeGreaterThan(-1);
    expect(scriptIndex).toBeLessThan(stylesheetIndex);
  }, 20_000);
});
