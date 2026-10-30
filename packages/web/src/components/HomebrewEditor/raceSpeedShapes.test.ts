import { describe, expect, it } from "vitest";
import { readSpeed, writeSpeed } from "./raceSpeedShapes.ts";

describe("readSpeed", () => {
  it("reads a bare number as the walking speed and an object per mode, true included", () => {
    expect(readSpeed(30)).toEqual({ walk: 30 });
    expect(readSpeed({ walk: 25, fly: true, swim: 40 })).toEqual({ walk: 25, fly: true, swim: 40 });
    expect(readSpeed(undefined).walk).toBeUndefined();
  });

  it("does not read true as a walking speed", () => {
    expect(readSpeed({ walk: true }).walk).toBeUndefined();
  });
});

describe("writeSpeed", () => {
  it("writes a walking speed alone as the bare number", () => {
    expect(writeSpeed(undefined, "walk", 30)).toBe(30);
    expect(writeSpeed({ walk: 30, fly: 30 }, "fly", undefined)).toEqual({ walk: 30 });
    expect(writeSpeed(30, "walk", 35)).toBe(35);
  });

  it("writes an object once there is a second mode, keeping what else it holds", () => {
    expect(writeSpeed(30, "fly", true)).toEqual({ walk: 30, fly: true });
    expect(writeSpeed({ walk: 30, hover: true }, "swim", 20)).toEqual({
      walk: 30,
      hover: true,
      swim: 20,
    });
  });

  it("drops the field once nothing is left", () => {
    expect(writeSpeed(30, "walk", undefined)).toBeUndefined();
  });
});
