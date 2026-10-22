import { describe, expect, it } from "vitest";
import { characterRecord } from "../../../../test/records.ts";
import { withReopenedLevel } from "./reopenedLevel.ts";

describe("withReopenedLevel", () => {
  it("writes the departures Apply set, so a multiclass note reaches the character", () => {
    const latest = characterRecord("1", "Vex").definition;
    const departure = { field: "levels.1.class", note: "Multiclassing needs Intelligence 13." };
    const values = { ...latest, departures: [departure] };

    expect(withReopenedLevel(latest, 1, values).departures).toEqual([departure]);
  });
});
