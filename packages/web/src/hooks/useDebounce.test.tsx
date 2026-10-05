import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "./useDebounce.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebounce", () => {
  it("holds the first value, then takes the last change once it has held still", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 200), {
      initialProps: { value: "f" },
    });
    expect(result.current).toBe("f");

    rerender({ value: "fi" });
    act(() => vi.advanceTimersByTime(150));
    rerender({ value: "fir" });
    act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBe("f");

    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe("fir");
  });
});
