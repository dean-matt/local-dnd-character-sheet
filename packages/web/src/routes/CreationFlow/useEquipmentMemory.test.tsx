import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { NO_EQUIPMENT } from "./equipmentPicks.ts";
import { useEquipmentMemory } from "./useEquipmentMemory.ts";

const KEY = "draft:creation:equipment";
const picked = { ...NO_EQUIPMENT, gold: { row: "Fighter|PHB", gp: 120 } };

describe("useEquipmentMemory", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the picks across a reload", () => {
    const first = renderHook(() => useEquipmentMemory(true));
    act(() => first.result.current[1](picked));
    first.unmount();

    const reloaded = renderHook(() => useEquipmentMemory(false));
    expect(reloaded.result.current[0]).toEqual(picked);
  });

  it("starts a fresh flow from none, discarding an earlier flow's picks", () => {
    localStorage.setItem(KEY, JSON.stringify(picked));

    const fresh = renderHook(() => useEquipmentMemory(true));

    expect(fresh.result.current[0]).toEqual(NO_EQUIPMENT);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
