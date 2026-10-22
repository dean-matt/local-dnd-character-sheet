import { describe, expect, it } from "vitest";
import { characterRecord } from "../../../test/records.ts";
import { withReopenedLevel } from "./reopenedLevel.ts";

describe("withReopenedLevel", () => {
  it("writes the departures Apply set, so a multiclass note reaches the character", () => {
    const latest = characterRecord("1", "Vex").definition;
    const departure = { field: "levels.1.class", note: "Multiclassing needs Intelligence 13." };
    const values = { ...latest, departures: [departure] };

    expect(withReopenedLevel(latest, 1, values).departures).toEqual([departure]);
  });

  it("writes the proficiencies Apply swapped, so a new starting class's grants reach the character", () => {
    const latest = characterRecord("1", "Vex").definition;
    const proficiencies = { ...latest.proficiencies, armor: ["Heavy"] };

    expect(withReopenedLevel(latest, 1, { ...latest, proficiencies }).proficiencies).toEqual(
      proficiencies,
    );
  });
});
