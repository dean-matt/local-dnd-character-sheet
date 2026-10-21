import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import viteConfig from "../vitest.config.ts";
import { ROOT, read } from "./lib/doc-helpers.ts";

/**
 * Fences the two waits `docs/test-waits.md` names as mistakes a parser can see: a global
 * `asyncUtilTimeout`, and a `setTimeout` sleep in a web test. Which element a wait watches
 * against which one the test asserts on is left to review.
 */

/**
 * Each web test file still sleeping, how many sleeps it holds, and why. Counts are exact,
 * so a sleep removed lowers its count and a new one needs an entry naming its reason.
 */
const ALLOWED_SLEEPS = new Map<string, { count: number; why: string }>([
  [
    "packages/web/src/router.test.tsx",
    { count: 1, why: "a scroll restore that must not happen has no signal" },
  ],
  [
    "packages/web/src/components/blocks/InventorySection/InventorySection.test.tsx",
    { count: 1, why: "a save that must not start has no signal" },
  ],
  [
    "packages/web/src/components/Field/Field.test.tsx",
    { count: 2, why: "a save that must not fire inside the debounce window has no signal" },
  ],
  [
    "packages/web/src/hooks/useCharacterPages.test.tsx",
    { count: 2, why: "a request that must not go out has no signal" },
  ],
  [
    "packages/web/src/routes/CharacterPage/PageEditor.test.tsx",
    { count: 1, why: "a dropped save that must not reach the server has no signal" },
  ],
  [
    "packages/web/src/routes/CreationFlow/IdentityStep.test.tsx",
    { count: 1, why: "a query whose row must stay empty has no visible effect" },
  ],
]);

/** A `setTimeout` handed the resolver of the promise around it, across any line wrap. */
const SLEEP =
  /new\s+Promise\s*(?:<[^>]*>)?\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\{?\s*setTimeout\(\s*\1\b/g;
const TIMER_PROMISES = /from\s+["'](?:node:)?timers\/promises["']/g;

function sleeps(source: string): number {
  return [...source.matchAll(SLEEP)].length + [...source.matchAll(TIMER_PROMISES)].length;
}

function setsGlobalWait(source: string): boolean {
  return /\basyncUtilTimeout\b/.test(source);
}

const setupFiles = (viteConfig.test?.projects ?? []).flatMap((project) => {
  if (typeof project !== "object" || !("test" in project) || !project.test) return [];
  const { setupFiles: files } = project.test;
  return (files === undefined ? [] : [files].flat()).map((file) => file.replace(/^\.\//, ""));
});

const webTests = globSync("packages/web/src/**/*.test.{ts,tsx}", { cwd: ROOT }).map((path) =>
  path.replaceAll("\\", "/"),
);

describe("the wait detectors", () => {
  it("count a sleep however it is spelled", () => {
    expect(sleeps("await new Promise((resolve) => setTimeout(resolve, 50));")).toBe(1);
    expect(sleeps("await new Promise<void>(r =>\n  setTimeout(r, 20));")).toBe(1);
    expect(sleeps("await new Promise((done) => { setTimeout(done, 0); });")).toBe(1);
    expect(sleeps('import { setTimeout as sleep } from "node:timers/promises";')).toBe(1);
  });

  it("leave a timer that is not a wait alone", () => {
    expect(sleeps("setTimeout(() => setOpen(false), 100);")).toBe(0);
    expect(sleeps('vi.useFakeTimers({ toFake: ["setTimeout"] });')).toBe(0);
  });

  it("see a global wait in either spelling", () => {
    expect(setsGlobalWait("configure({ asyncUtilTimeout: 3000 });")).toBe(true);
    expect(setsGlobalWait("const asyncUtilTimeout = 3000;")).toBe(true);
    expect(setsGlobalWait("await waitFor(check, { timeout: 3000 });")).toBe(false);
  });
});

describe("test waits", () => {
  it("find the setup files and web tests to check", () => {
    expect(setupFiles.length).toBeGreaterThan(0);
    expect(webTests.length).toBeGreaterThan(0);
  });

  it.each(setupFiles)("%s sets no global asyncUtilTimeout", (file) => {
    expect(
      setsGlobalWait(read(file)),
      `${file} widens every wait — scope a timeout to the one test that needs it`,
    ).toBe(false);
  });

  it("sleeps only where the allowlist says, as many times as it says", () => {
    const found = new Map(
      webTests.flatMap((file) => {
        const count = sleeps(read(file));
        return count > 0 ? [[file, count] as const] : [];
      }),
    );
    const allowed = new Map([...ALLOWED_SLEEPS].map(([file, { count }]) => [file, count]));
    expect(found, "a sleep needs an allowlist entry naming why — see docs/test-waits.md").toEqual(
      allowed,
    );
  });
});
