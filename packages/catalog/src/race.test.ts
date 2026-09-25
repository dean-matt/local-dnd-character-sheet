import { describe, expect, it } from "vitest";
import {
  homebrewRaceInputSchema,
  homebrewRaceRecordSchema,
  raceRecordSchema,
  raceTraitsSchema,
  subraceRecordSchema,
} from "./index.ts";

describe("raceRecordSchema", () => {
  it("accepts a catalog row", () => {
    const record = {
      name: "Elf",
      source: "PHB",
      edition: "classic",
      json: { name: "Elf", source: "PHB", entries: ["Elves are a magical people."] },
    };
    expect(raceRecordSchema.parse(record)).toEqual(record);
  });
});

describe("subraceRecordSchema", () => {
  it("accepts a subrace, keyed by its race as well as its own name and source", () => {
    const record = {
      name: "High",
      source: "PHB",
      raceName: "Elf",
      raceSource: "PHB",
      edition: "classic",
      json: { name: "High", source: "PHB" },
    };
    expect(subraceRecordSchema.parse(record)).toEqual(record);
  });

  it("accepts the empty name a base variant with no subrace of its own carries", () => {
    const record = {
      name: "",
      source: "PHB",
      raceName: "Human",
      raceSource: "PHB",
      edition: "classic",
      json: { name: "Human", source: "PHB" },
    };
    expect(subraceRecordSchema.parse(record)).toEqual(record);
  });
});

describe("homebrewRaceInputSchema", () => {
  const duskling = { name: "Duskling", edition: "one", size: ["M"], speed: 30 };

  it("accepts a name, an edition, a size and a speed without a source", () => {
    expect(homebrewRaceInputSchema.parse(duskling)).toEqual(duskling);
  });

  it("keeps a field this schema does not model, such as an ability score increase", () => {
    const withUnmodeledField = { ...duskling, ability: [{ dex: 2 }] };
    expect(homebrewRaceInputSchema.parse(withUnmodeledField)).toEqual(withUnmodeledField);
  });

  it("rejects a race that states no size, since a derived block reads one", () => {
    const { size: _, ...sizeless } = duskling;
    const result = homebrewRaceInputSchema.safeParse(sizeless);
    expect(result.error?.issues[0]?.path).toEqual(["size"]);
  });

  it("rejects a missing name, naming the failed field", () => {
    const result = homebrewRaceInputSchema.safeParse({ ...duskling, name: undefined });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["name"]);
  });

  it("rejects an edition outside the two rulesets", () => {
    const result = homebrewRaceInputSchema.safeParse({ ...duskling, edition: "3.5" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["edition"]);
  });
});

describe("homebrewRaceRecordSchema", () => {
  it("accepts a stored row", () => {
    const record = {
      id: "1",
      name: "Duskling",
      edition: "one",
      json: { name: "Duskling", source: "HB" },
      createdAt: new Date(0).toISOString(),
    };
    expect(homebrewRaceRecordSchema.parse(record)).toEqual(record);
  });
});

describe("raceTraitsSchema", () => {
  it("reads a bare number as the walking speed", () => {
    expect(raceTraitsSchema.parse({ size: ["M"], speed: 30 })).toEqual({
      size: "medium",
      speed: { walk: 30 },
    });
  });

  it("reads a mode written as true as the walking speed", () => {
    expect(
      raceTraitsSchema.parse({ size: ["M"], speed: { walk: 30, fly: true, swim: 20 } }),
    ).toEqual({ size: "medium", speed: { walk: 30, fly: 30, swim: 20 } });
  });

  it("takes the largest size a race offers, and reads varies as medium", () => {
    expect(raceTraitsSchema.parse({ size: ["S", "M"], speed: 30 }).size).toBe("medium");
    expect(raceTraitsSchema.parse({ size: ["S"], speed: 25 }).size).toBe("small");
    expect(raceTraitsSchema.parse({ size: ["V"], speed: 30 }).size).toBe("medium");
  });

  it("rejects a race that states no size or speed", () => {
    expect(raceTraitsSchema.safeParse({ speed: 30 }).success).toBe(false);
    expect(raceTraitsSchema.safeParse({ size: ["M"] }).success).toBe(false);
  });
});
