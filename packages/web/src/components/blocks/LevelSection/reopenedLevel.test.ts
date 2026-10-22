import { describe, expect, it } from "vitest";
import { NO_GRANTS } from "../../../lib/proficiencyGrants.ts";
import { characterRecord } from "../../../test/records.ts";
import { withReopenedLevel } from "./reopenedLevel.ts";

describe("withReopenedLevel", () => {
  it("writes the departures Apply set, so a multiclass note reaches the character", () => {
    const latest = characterRecord("1", "Vex").definition;
    const departure = { field: "levels.1.class", note: "Multiclassing needs Intelligence 13." };
    const values = { ...latest, departures: [departure] };

    expect(withReopenedLevel(latest, 1, values).departures).toEqual([departure]);
  });

  it("swaps the latest proficiencies, ignoring any the draft holds, so a retry cannot stack", () => {
    const latest = characterRecord("1", "Vex").definition;
    const held = { ...latest.proficiencies, savingThrows: ["wis" as const, "cha" as const] };
    const swap = {
      was: { ...NO_GRANTS, savingThrows: ["wis" as const, "cha" as const] },
      now: { ...NO_GRANTS, savingThrows: ["dex" as const, "int" as const] },
      still: NO_GRANTS,
    };
    const drafted = { ...latest, proficiencies: { ...held, armor: ["Heavy"] } };

    expect(
      withReopenedLevel({ ...latest, proficiencies: held }, 1, drafted, swap).proficiencies,
    ).toEqual({ ...held, savingThrows: ["dex", "int"] });
  });
});
