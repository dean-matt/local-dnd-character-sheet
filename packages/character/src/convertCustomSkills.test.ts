import type { Edition } from "@dnd/rules";
import { describe, expect, it } from "vitest";
import {
  convertCustomSkills,
  type ExistingHomebrewSkill,
  type StoredCharacter,
} from "./convertCustomSkills.ts";
import { definition } from "./test/vex.ts";

type Custom = { name: string; ability?: string; flat?: number; level?: string };

const character = (
  id: string,
  customSkills: Custom[],
  extra: Record<string, unknown> = {},
  snapshots: StoredCharacter["snapshots"] = [],
): StoredCharacter => ({
  id,
  definition: {
    ...definition,
    customSkills: customSkills.map((skill) => ({ level: "none", ...skill })),
    ...extra,
  },
  snapshots,
});

const overridesOf = (result: ReturnType<typeof convert>) =>
  (result.characters[0] as unknown as { definition: { overrides: object } }).definition.overrides;

const catalog = (edition: Edition) => (edition === "classic" ? ["Perception"] : ["Perception"]);

const convert = (characters: StoredCharacter[], existing: ExistingHomebrewSkill[] = []) =>
  convertCustomSkills(characters, existing, catalog);

const rows = (result: ReturnType<typeof convert>) =>
  result.homebrewToAdd.map((row) => `${row.name}:${row.ability}`);

const heldBy = (result: ReturnType<typeof convert>, id: string) => {
  const converted = result.characters.find((each) => each.id === id)?.definition as {
    proficiencies: {
      skills: { ref: { name: string; source: string }; level: string; flat?: number }[];
    };
  };
  return converted.proficiencies.skills
    .filter((skill) => skill.ref.source === "HB")
    .map((skill) => ({ name: skill.ref.name, level: skill.level, flat: skill.flat }));
};

describe("convertCustomSkills", () => {
  it("holds an ability skill and a flat skill with their levels and the flat number", () => {
    const result = convert([
      character("a", [
        { name: "Juggling", ability: "dex", level: "expertise" },
        { name: "Cartography", flat: 3, level: "proficient" },
      ]),
    ]);

    expect(rows(result)).toEqual(["Juggling:dex", "Cartography:flat"]);
    expect(heldBy(result, "a")).toEqual([
      { name: "Juggling", level: "expertise", flat: undefined },
      { name: "Cartography", level: "proficient", flat: 3 },
    ]);
    expect(result.characters[0]?.definition).not.toHaveProperty("customSkills");
  });

  it("keeps two editions apart, each with its own spelling", () => {
    const result = convert([
      character("a", [{ name: "Foo", ability: "str" }], { edition: "classic" }),
      character("b", [{ name: "foo", ability: "str" }], { edition: "one" }),
    ]);

    expect(result.homebrewToAdd).toEqual([
      { name: "Foo", edition: "classic", ability: "str" },
      { name: "foo", edition: "one", ability: "str" },
    ]);
  });

  it("merges one name and form across characters, in the earliest character's spelling", () => {
    const result = convert([
      character("a", [{ name: "Foo", ability: "str" }]),
      character("b", [{ name: "FOO", ability: "str" }]),
    ]);

    expect(rows(result)).toEqual(["Foo:str"]);
    expect(heldBy(result, "b")[0]?.name).toBe("Foo");
  });

  it("merges into an existing homebrew skill and takes its spelling", () => {
    const result = convert(
      [character("a", [{ name: "foo", ability: "str" }])],
      [{ name: "Foo", edition: "one", ability: "str" }],
    );

    expect(rows(result)).toEqual([]);
    expect(heldBy(result, "a")[0]?.name).toBe("Foo");
  });

  it("merges two of one character's skills, keeping the higher level and flat number and the first's overrides", () => {
    const result = convert([
      character(
        "a",
        [
          { name: "Foo", flat: 2, level: "proficient" },
          { name: "foo", flat: 5, level: "none" },
        ],
        { overrides: { "customSkills.Foo.modifier": 9, "customSkills.foo.modifier": 1 } },
      ),
    ]);

    expect(heldBy(result, "a")).toEqual([{ name: "Foo", level: "proficient", flat: 5 }]);
    const overrides = overridesOf(result);
    expect(overrides).toEqual({ "skills.Foo|HB.modifier": 9 });
  });

  it("breaks equal levels by the higher flat number, then the earlier entry", () => {
    const higher = convert([
      character(
        "a",
        [
          { name: "Foo", flat: 2 },
          { name: "foo", flat: 5 },
        ],
        { overrides: { "customSkills.Foo.modifier": 1, "customSkills.foo.modifier": 2 } },
      ),
    ]);
    const earlier = convert([
      character(
        "a",
        [
          { name: "Foo", flat: 4 },
          { name: "foo", flat: 4 },
        ],
        { overrides: { "customSkills.Foo.modifier": 1, "customSkills.foo.modifier": 2 } },
      ),
    ]);

    expect(overridesOf(higher)).toEqual({ "skills.Foo|HB.modifier": 2 });
    expect(overridesOf(earlier)).toEqual({ "skills.Foo|HB.modifier": 1 });
  });

  it("keeps each character's own level and flat number when they merge into one row", () => {
    const result = convert([
      character("a", [{ name: "Foo", flat: 1, level: "proficient" }]),
      character("b", [{ name: "Foo", flat: 8, level: "none" }]),
    ]);

    expect(rows(result)).toEqual(["Foo:flat"]);
    expect(heldBy(result, "a")).toEqual([{ name: "Foo", level: "proficient", flat: 1 }]);
    expect(heldBy(result, "b")).toEqual([{ name: "Foo", level: "none", flat: 8 }]);
  });

  describe("one name, several forms", () => {
    it("numbers every form after the first, ranking the abilities and then flat", () => {
      const result = convert([
        character("a", [
          { name: "Foo", flat: 1 },
          { name: "Foo", ability: "dex" },
          { name: "Foo", ability: "str" },
        ]),
      ]);

      expect(rows(result)).toEqual(["Foo:str", "Foo (2):dex", "Foo (3):flat"]);
    });

    it("passes over a taken number, existing or another character's literal name", () => {
      const existing = convert(
        [
          character("a", [
            { name: "Foo", ability: "str" },
            { name: "Foo", ability: "dex" },
          ]),
        ],
        [{ name: "Foo (2)", edition: "one", ability: "wis" }],
      );
      const literal = convert([
        character("a", [
          { name: "Foo", ability: "str" },
          { name: "Foo", ability: "dex" },
        ]),
        character("b", [{ name: "Foo (2)", ability: "wis" }]),
      ]);

      expect(rows(existing)).toEqual(["Foo:str", "Foo (3):dex"]);
      expect(rows(literal)).toEqual(["Foo:str", "Foo (3):dex", "Foo (2):wis"]);
    });

    it("lets an existing homebrew skill keep the plain name and numbers every other form", () => {
      const result = convert(
        [
          character("a", [
            { name: "Foo", ability: "str" },
            { name: "Foo", ability: "dex" },
          ]),
        ],
        [{ name: "Foo", edition: "one", ability: "dex" }],
      );

      expect(rows(result)).toEqual(["Foo (2):str"]);
    });
  });

  describe("a name the catalog holds", () => {
    it("suffixes every form, in the catalog's spelling", () => {
      const lone = convert([character("a", [{ name: "perception", ability: "str" }])]);
      const both = convert([
        character("a", [
          { name: "Perception", ability: "str" },
          { name: "Perception", ability: "dex" },
        ]),
      ]);

      expect(rows(lone)).toEqual(["Perception (2):str"]);
      expect(rows(both)).toEqual(["Perception (2):str", "Perception (3):dex"]);
    });

    it("merges two characters holding the same form into one suffixed skill", () => {
      const result = convert([
        character("a", [{ name: "Perception", ability: "str" }]),
        character("b", [{ name: "Perception", ability: "str" }]),
      ]);

      expect(rows(result)).toEqual(["Perception (2):str"]);
    });

    it("does not merge with an existing homebrew skill of that name and passes over numbers taken", () => {
      const result = convert(
        [character("a", [{ name: "Perception", ability: "str" }])],
        [
          { name: "Perception", edition: "one", ability: "str" },
          { name: "Perception (2)", edition: "one", ability: "str" },
        ],
      );

      expect(rows(result)).toEqual(["Perception (3):str"]);
    });
  });

  it("moves an override to the skill under its new name and drops the old key", () => {
    const result = convert([
      character("a", [{ name: "Perception", ability: "str" }], {
        overrides: { "customSkills.Perception.modifier": 4, "speed.walk": 40 },
      }),
    ]);

    expect(overridesOf(result)).toEqual({
      "skills.Perception (2)|HB.modifier": 4,
      "speed.walk": 40,
    });
  });

  it("reports each skill that took a new name, on the character that held it", () => {
    const result = convert([
      character("a", [
        { name: "Perception", ability: "str" },
        { name: "Juggling", ability: "dex" },
      ]),
      character("b", [{ name: "Perception", ability: "str" }]),
    ]);

    expect(result.renames).toEqual([
      { characterId: "a", from: "Perception", to: "Perception (2)" },
      { characterId: "b", from: "Perception", to: "Perception (2)" },
    ]);
  });

  it("reads the catalog only for an edition holding an entry", () => {
    const asked: Edition[] = [];
    convertCustomSkills(
      [character("a", [{ name: "Foo", ability: "str" }], { edition: "one" }), character("b", [])],
      [],
      (edition) => {
        asked.push(edition);
        return [];
      },
    );

    expect(asked).toEqual(["one"]);
  });

  describe("undo snapshots", () => {
    const snapshot = (id: number, customSkills?: Custom[]) => ({
      id,
      previousState: customSkills ? { ...definition, customSkills } : { ...definition },
    });

    it("strips an empty key and keeps the row", () => {
      const result = convert([character("a", [], {}, [snapshot(1, [])])]);

      expect(result.snapshots).toEqual([
        {
          characterId: "a",
          id: 1,
          keep: { previousState: expect.not.objectContaining({ customSkills: [] }) },
        },
      ]);
    });

    it("drops a row holding entries, and the row that first added one", () => {
      const withFoo = { name: "Foo", ability: "str", level: "none" };
      const result = convert([
        character("a", [withFoo], {}, [snapshot(1, []), snapshot(2, [withFoo])]),
      ]);

      expect(result.snapshots.map((row) => [row.id, row.keep])).toEqual([
        [1, false],
        [2, false],
      ]);
    });

    it("keeps a snapshot without the key as it is", () => {
      const result = convert([character("a", [], {}, [snapshot(1)])]);

      expect(result.snapshots).toEqual([]);
    });
  });

  it("leaves a character without the key out of the result", () => {
    const { customSkills: _gone, ...plain } = definition as unknown as Record<string, unknown>;
    const result = convert([{ id: "a", definition: plain, snapshots: [] }]);

    expect(result.characters).toEqual([]);
  });
});
