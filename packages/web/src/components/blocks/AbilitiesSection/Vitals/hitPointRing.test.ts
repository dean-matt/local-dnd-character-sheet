import { describe, expect, it } from "vitest";
import { hitPointRing, ringBackground } from "./hitPointRing.ts";

const arc = (start: number, length: number) => ({ start, length });

describe("hitPointRing", () => {
  it("fills in proportion to current hit points, with temporary hit points straight after", () => {
    expect(hitPointRing({ current: 10, temporary: 5, maximum: 20, unreduced: 20 })).toEqual({
      current: arc(0, 0.5),
      temporary: arc(0.5, 0.25),
      reduction: arc(1, 0),
    });
  });

  it("ends with the reduction, scaled against the maximum before it", () => {
    expect(hitPointRing({ current: 10, temporary: 0, maximum: 15, unreduced: 20 })).toEqual({
      current: arc(0, 0.5),
      temporary: arc(0.5, 0),
      reduction: arc(0.75, 0.25),
    });
  });

  it("lets temporary hit points cover the reduction where they reach past the reduced maximum", () => {
    expect(hitPointRing({ current: 15, temporary: 3, maximum: 15, unreduced: 20 })).toEqual({
      current: arc(0, 0.75),
      temporary: arc(0.75, 0.15),
      reduction: arc(0.9, 0.1),
    });
  });

  it("rescales to current plus temporary hit points past the unreduced maximum, drawing nothing twice", () => {
    const ring = hitPointRing({ current: 15, temporary: 10, maximum: 15, unreduced: 20 });
    expect(ring).toEqual({
      current: arc(0, 0.6),
      temporary: arc(0.6, 0.4),
      reduction: arc(1, 0),
    });
  });

  it("draws nothing for current hit points below 0", () => {
    expect(hitPointRing({ current: -3, temporary: 0, maximum: 20, unreduced: 20 }).current).toEqual(
      arc(0, 0),
    );
  });
});

describe("ringBackground", () => {
  it("cuts the track away along the reduction, over hatching", () => {
    const background = ringBackground(
      hitPointRing({ current: 10, temporary: 2, maximum: 15, unreduced: 20 }),
    );
    expect(background).toBe(
      "conic-gradient(var(--color-accent) 0 50%, var(--color-temporary) 50% 60%, " +
        "var(--color-subtle) 60% 75%, transparent 75% 100%, var(--color-subtle) 100% 100%), " +
        "repeating-linear-gradient(45deg, var(--color-muted) 0 2px, var(--color-subtle) 2px 5px)",
    );
  });
});
