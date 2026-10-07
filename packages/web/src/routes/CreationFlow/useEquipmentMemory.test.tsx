import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { NO_EQUIPMENT } from "./equipmentPicks.ts";
import { useEquipmentMemory } from "./useEquipmentMemory.ts";

const KEY = "draft:creation:equipment";
const picked = { ...NO_EQUIPMENT, gold: { row: "Fighter|PHB", gp: 120 } };

describe("useEquipmentMemory", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the picks across a reload, which unloads the page without unmounting", () => {
    const first = renderHook(() => useEquipmentMemory(true));
    act(() => first.result.current[1](picked));

    const reloaded = renderHook(() => useEquipmentMemory(false));
    expect(reloaded.result.current[0]).toEqual(picked);
  });

  it("discards the picks once the flow is left", () => {
    const flow = renderHook(() => useEquipmentMemory(true));
    act(() => flow.result.current[1](picked));

    flow.unmount();

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("starts a fresh flow from none, discarding an earlier flow's picks", () => {
    localStorage.setItem(KEY, JSON.stringify(picked));

    const fresh = renderHook(() => useEquipmentMemory(true));

    expect(fresh.result.current[0]).toEqual(NO_EQUIPMENT);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toEqual(NO_EQUIPMENT);
  });
});
