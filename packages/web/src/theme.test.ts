import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredTheme, setStoredTheme } from "./theme.ts";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to system when nothing is stored", () => {
    expect(getStoredTheme()).toBe("system");
  });

  it("persists an override and reflects it in the document", () => {
    setStoredTheme("dark");

    expect(getStoredTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("clears the override on system, in storage and on the document", () => {
    setStoredTheme("light");
    setStoredTheme("system");

    expect(getStoredTheme()).toBe("system");
    expect(localStorage.getItem("theme")).toBeNull();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("ignores a corrupt stored value", () => {
    localStorage.setItem("theme", "sepia");

    expect(getStoredTheme()).toBe("system");
  });

  it("still applies the theme to the document when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    setStoredTheme("dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
