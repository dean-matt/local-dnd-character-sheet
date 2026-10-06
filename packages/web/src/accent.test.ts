import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  deriveAccent,
  getStoredAccent,
  refreshStoredAccent,
  setStoredAccent,
} from "./accent.ts";
import { contrastRatio, hex, mixOklab, subtleDark, surfaceDark, white } from "./lib/contrast.ts";

const rootStyle = () => document.documentElement.style;

function derived(color: string) {
  const result = deriveAccent(color);
  if ("refusal" in result) throw new Error(result.refusal);
  return result.accent;
}

describe("deriveAccent", () => {
  it.each(ACCENT_PRESETS)("clears the $name preset", ({ color }) => {
    expect(deriveAccent(color)).toHaveProperty("accent");
  });

  it("refuses a color too light for the light theme, saying by how much", () => {
    expect(deriveAccent("#d9730d")).toEqual({
      refusal: "Too light for the light theme: it measures 3.00:1 where AA needs 4.5:1.",
    });
  });

  it("refuses a color no dark shade clears", async () => {
    // A dark surface this light leaves no shade both 3:1 on it and under white text at 4.5:1.
    vi.resetModules();
    vi.doMock("./lib/contrast.ts", async (original) => ({
      ...(await original<typeof import("./lib/contrast.ts")>()),
      surfaceDark: [0.1, 0.1, 0.1],
    }));
    const mocked = await import("./accent.ts");
    vi.doUnmock("./lib/contrast.ts");

    expect(mocked.deriveAccent(DEFAULT_ACCENT)).toEqual({
      refusal:
        "No shade of it in the dark theme keeps both white text on it and its focus ring readable.",
    });
  });

  it("lightens a dark color in the dark theme as little as clears its pairs", () => {
    const { ring, text } = derived("#3a4f7a");
    const shade = (lift: number) => mixOklab(hex("#3a4f7a"), white, 1 - lift / 100);

    expect(contrastRatio(shade(ring), surfaceDark)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(white, shade(ring))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(shade(ring - 1), surfaceDark)).toBeLessThan(3);
    expect(contrastRatio(shade(text), subtleDark)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(shade(text - 1), subtleDark)).toBeLessThan(4.5);
  });
});

describe("the stored accent", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the default accent when nothing is stored", () => {
    expect(getStoredAccent()).toBe(DEFAULT_ACCENT);
  });

  it("persists a choice and sets the base accent and its lifts on the document", () => {
    setStoredAccent(derived("#3a4f7a"));

    expect(getStoredAccent()).toBe("#3a4f7a");
    expect(rootStyle().getPropertyValue("--accent")).toBe("#3a4f7a");
    expect(rootStyle().getPropertyValue("--accent-ring-lift")).toBe("21%");
    expect(rootStyle().getPropertyValue("--accent-text-lift")).toBe("46%");
  });

  it("clears the choice on the default, in storage and on the document", () => {
    setStoredAccent(derived("#3a4f7a"));
    setStoredAccent(derived(DEFAULT_ACCENT));

    expect(localStorage.getItem("accent")).toBeNull();
    expect(rootStyle().getPropertyValue("--accent")).toBe("");
  });

  it("re-derives stale stored lifts on refresh", () => {
    localStorage.setItem("accent", JSON.stringify({ color: "#3a4f7a", ring: 3, text: 5 }));

    refreshStoredAccent();

    expect(JSON.parse(localStorage.getItem("accent") ?? "null")).toEqual(derived("#3a4f7a"));
    expect(rootStyle().getPropertyValue("--accent-ring-lift")).toBe("21%");
  });

  it("ignores a corrupt stored value", () => {
    localStorage.setItem("accent", JSON.stringify({ color: "red", ring: 21, text: 46 }));

    expect(getStoredAccent()).toBe(DEFAULT_ACCENT);
  });

  it("still applies the accent to the document when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    setStoredAccent(derived("#3a4f7a"));

    expect(rootStyle().getPropertyValue("--accent")).toBe("#3a4f7a");
  });
});

describe("index.html's pre-paint script", () => {
  const html = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
  const run = () => new Function(script)();

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  it("applies the accent setStoredAccent stored", () => {
    setStoredAccent(derived("#3a4f7a"));
    document.documentElement.removeAttribute("style");

    run();

    expect(rootStyle().getPropertyValue("--accent")).toBe("#3a4f7a");
    expect(rootStyle().getPropertyValue("--accent-ring-lift")).toBe("21%");
    expect(rootStyle().getPropertyValue("--accent-text-lift")).toBe("46%");
  });

  it.each([
    "not json",
    JSON.stringify({ color: "#3a4f7a" }),
    JSON.stringify({ color: "#3a4f7a; color: red", ring: 21, text: 46 }),
    JSON.stringify({ color: "#3a4f7a", ring: 101, text: 46 }),
  ])("ignores a malformed stored accent: %s", (stored) => {
    localStorage.setItem("accent", stored);

    run();

    expect(rootStyle().getPropertyValue("--accent")).toBe("");
  });
});
