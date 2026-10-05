import { afterEach, describe, expect, it, vi } from "vitest";

async function freshModule() {
  vi.resetModules();
  return import("./disabledSources.ts");
}

afterEach(() => {
  localStorage.clear();
});

describe("disabledSources", () => {
  it("survives a reload, sorted and without duplicates", async () => {
    (await freshModule()).setDisabledSources(["VGM", "SCAG", "VGM"]);

    expect((await freshModule()).getDisabledSources()).toEqual(["SCAG", "VGM"]);
  });

  it("notifies a subscriber on each change", async () => {
    const { setDisabledSources, subscribeDisabledSources } = await freshModule();
    const listener = vi.fn();
    const unsubscribe = subscribeDisabledSources(listener);

    setDisabledSources(["VGM"]);
    unsubscribe();
    setDisabledSources([]);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reads a malformed stored value as every source on", async () => {
    localStorage.setItem("disabledSources", '{"VGM":true}');

    expect((await freshModule()).getDisabledSources()).toEqual([]);
  });
});
