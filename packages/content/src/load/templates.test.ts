import { describe, expect, it } from "vitest";
import { resolveCopies } from "./copy.ts";

type Entry = Record<string, unknown>;

const BESTIARY = "data/bestiary/bestiary-mm.json";
const TEMPLATES = "data/bestiary/template.json";

/**
 * A creature and the templates it may name, through the resolver a loader gets.
 * Templates sit in their own file, which is the arrangement upstream ships and
 * the reason the pool has to span every source rather than one document.
 */
function resolve(monsters: Entry[], templates: Entry[]): Entry[] {
  const resolved = resolveCopies(
    new Map<string, unknown>([
      [TEMPLATES, { monsterTemplate: templates }],
      [BESTIARY, { monster: monsters }],
    ]),
  );
  return (resolved.get(BESTIARY) as Entry).monster as Entry[];
}

/** One creature copying `Base` (MM) under one template, resolved. */
function underTemplate(base: Entry, copy: Entry, ...templates: Entry[]): Entry {
  const first = templates[0] as Entry;
  const child = {
    name: "Child",
    source: "MM",
    _copy: {
      name: "Base",
      source: "MM",
      _templates: [{ name: first.name, source: first.source }],
      ...copy,
    },
  };
  const resolved = resolve([{ name: "Base", source: "MM", ...base }, child], templates);
  return resolved[1] as Entry;
}

/** A template applying one whole-entry operation, which is where most of the modes live. */
const whole = (name: string, op: Entry): Entry => ({
  name,
  source: "MM",
  apply: { _mod: { _: op } },
});

describe("_copy._templates", () => {
  it("writes apply._root onto the creature", () => {
    const child = underTemplate(
      { size: ["S"] },
      {},
      {
        name: "Mountain Dwarf",
        source: "PHB",
        apply: { _root: { size: ["M"], speed: { walk: 25 } } },
      },
    );

    expect(child.size).toEqual(["M"]);
    expect(child.speed).toEqual({ walk: 25 });
  });

  /**
   * One template writes the same `_root` onto every creature naming it — 17
   * mountain dwarf NPCs share a `speed` — and a `setProp` down a dotted path
   * mutates in place.
   */
  it("gives each creature its own copy of what _root writes", () => {
    const template = {
      name: "Mountain Dwarf",
      source: "PHB",
      apply: { _root: { speed: { walk: 25 } } },
    };
    const under = (name: string, mod: Entry) => ({
      name,
      source: "MM",
      _copy: {
        name: "Base",
        source: "MM",
        _templates: [{ name: "Mountain Dwarf", source: "PHB" }],
        _mod: mod,
      },
    });
    const resolved = resolve(
      [
        { name: "Base", source: "MM" },
        under("Flier", { _: { mode: "setProp", prop: "speed.fly", value: 60 } }),
        under("Walker", {}),
      ],
      [template],
    );

    expect((resolved[1] as Entry).speed).toEqual({ walk: 25, fly: 60 });
    expect((resolved[2] as Entry).speed).toEqual({ walk: 25 });
    expect(template.apply._root.speed).toEqual({ walk: 25 });
  });

  /**
   * `Umbraxakar` (WDMM) is why. It takes the Legendary Shadow Dragon template,
   * whose `_root` names the generic legendary group, and states the bronze one
   * itself. A `_root` that won would erase the reason the entry spells it out.
   */
  it("leaves a field the entry declares itself alone", () => {
    const resolved = resolve(
      [
        { name: "Base", source: "MM", speed: { walk: 30 } },
        {
          name: "Child",
          source: "MM",
          speed: { walk: 15 },
          _copy: {
            name: "Base",
            source: "MM",
            _templates: [{ name: "Mountain Dwarf", source: "PHB" }],
          },
        },
      ],
      [
        {
          name: "Mountain Dwarf",
          source: "PHB",
          apply: { _root: { speed: { walk: 25 } } },
        },
      ],
    );

    expect((resolved[1] as Entry).speed).toEqual({ walk: 15 });
  });

  it("applies apply._mod through the path a _copy._mod takes", () => {
    const child = underTemplate(
      { languages: ["Common"] },
      {},
      {
        name: "Mountain Dwarf",
        source: "PHB",
        apply: {
          _mod: {
            languages: { mode: "appendIfNotExistsArr", items: ["Common", "Dwarvish"] },
            trait: {
              mode: "appendArr",
              items: { name: "Dwarven Resilience", entries: ["Tough."] },
            },
          },
        },
      },
    );

    expect(child.languages).toEqual(["Common", "Dwarvish"]);
    expect(child.trait).toEqual([{ name: "Dwarven Resilience", entries: ["Tough."] }]);
  });

  /**
   * `Oracs the Enduring` (EGW) copies an ancient black dragon under the Dracolich
   * template, whose `*` rewrites "dragon" to "dracolich", and then rewrites "the
   * dracolich" to "Oracs". Running the entry's own mod first leaves the template
   * rewriting a name.
   */
  it("runs a template's mod before the entry's own", () => {
    const child = underTemplate(
      { trait: [{ name: "Bite", entries: ["The dragon bites."] }] },
      {
        _mod: { "*": { mode: "replaceTxt", replace: "the dracolich", with: "Oracs", flags: "i" } },
      },
      {
        name: "Dracolich",
        source: "MM",
        apply: { _mod: { "*": { mode: "replaceTxt", replace: "dragon", with: "dracolich" } } },
      },
    );

    expect(child.trait).toEqual([{ name: "Bite", entries: ["Oracs bites."] }]);
  });

  /**
   * Every block in the data names one template, so this fences the list the
   * schema allows rather than a creature that exists: a second template reads a
   * creature the first has already changed.
   */
  it("checks, roots and mods each template before reading the next", () => {
    const under = (...names: string[]) => [
      { name: "Base", source: "MM", int: 2, size: ["M"], type: "beast" },
      {
        name: "Child",
        source: "MM",
        _copy: {
          name: "Base",
          source: "MM",
          _templates: names.map((name) => ({ name, source: "PHB" })),
        },
      },
    ];
    const templates = [
      { name: "Awaken", source: "PHB", apply: { _root: { int: 10 } } },
      {
        name: "Awakened",
        source: "PHB",
        prerequisite: { int: { max: 3 } },
        apply: { _root: { type: "plant" } },
      },
    ];

    expect((resolve(under("Awakened", "Awaken"), templates)[1] as Entry).int).toBe(10);
    expect(() => resolve(under("Awaken", "Awakened"), templates)).toThrow(
      "its int is 10, over the template's 3",
    );
  });

  /**
   * `Hill Dwarf` (PHB) copies `Mountain Dwarf` and rewrites the tag through a
   * `setProp` on the dotted path `apply._root.type`, so the template a creature
   * gets is itself the result of a `_copy`.
   */
  it("resolves a template's own _copy first", () => {
    const child = underTemplate(
      {},
      {},
      {
        name: "Hill Dwarf",
        source: "PHB",
        _copy: {
          name: "Mountain Dwarf",
          source: "PHB",
          _mod: {
            _: {
              mode: "setProp",
              prop: "apply._root.type",
              value: { type: "humanoid", tags: ["hill"] },
            },
          },
        },
      },
      {
        name: "Mountain Dwarf",
        source: "PHB",
        apply: { _root: { type: { type: "humanoid", tags: ["mountain"] }, size: ["M"] } },
      },
    );

    expect(child.type).toEqual({ type: "humanoid", tags: ["hill"] });
    expect(child.size).toEqual(["M"]);
  });

  it("resolves a reference through an alias", () => {
    const resolved = resolve(
      [
        { name: "Base", source: "MM" },
        {
          name: "Child",
          source: "MM",
          _copy: {
            name: "Base",
            source: "MM",
            _templates: [{ name: "Strongheart Halfling", source: "PHB" }],
          },
        },
      ],
      [
        {
          name: "Stout Halfling",
          source: "PHB",
          alias: ["Strongheart Halfling"],
          apply: { _root: { size: ["S"] } },
        },
      ],
    );

    expect((resolved[1] as Entry).size).toEqual(["S"]);
  });

  /**
   * `Mountain Dwarf` (PHB) aliases "Shield Dwarf", and there is also a template
   * of that name which copies it. Both match the same reference, and the alias
   * exists to stand in for a template that is not there.
   */
  it("takes the template a reference names over one aliasing the same name", () => {
    const resolved = resolve(
      [
        { name: "Base", source: "MM" },
        {
          name: "Child",
          source: "MM",
          _copy: {
            name: "Base",
            source: "MM",
            _templates: [{ name: "Shield Dwarf", source: "PHB" }],
          },
        },
      ],
      [
        {
          name: "Mountain Dwarf",
          source: "PHB",
          alias: ["Shield Dwarf"],
          apply: { _root: { type: "mountain" } },
        },
        { name: "Shield Dwarf", source: "PHB", apply: { _root: { type: "shield" } } },
      ],
    );

    expect((resolved[1] as Entry).type).toBe("shield");
  });

  it("names both the creature and the template when no template matches", () => {
    expect(() =>
      resolve(
        [
          { name: "Base", source: "MM" },
          {
            name: "Child",
            source: "MM",
            _copy: { name: "Base", source: "MM", _templates: [{ name: "Vistana", source: "CoS" }] },
          },
        ],
        [{ name: "Mountain Dwarf", source: "PHB", apply: { _root: {} } }],
      ),
    ).toThrow(
      'applies the template "Vistana" (CoS), which no monsterTemplate the loader declared holds',
    );
  });

  it("refuses a template with no apply block", () => {
    expect(() => underTemplate({}, {}, { name: "Vistana", source: "CoS" })).toThrow(
      'the template "Vistana" (CoS) has nothing to apply',
    );
  });

  describe("the creatures a template fits", () => {
    it("refuses a creature under the template's crMin", () => {
      expect(() =>
        underTemplate(
          { cr: "1/2" },
          {},
          {
            name: "Reduced Threat",
            source: "TftYP",
            crMin: 2,
            apply: { _root: {} },
          },
        ),
      ).toThrow("its rating is 0.5, under the template's 2");
    });

    it("takes a creature at the crMin exactly", () => {
      const child = underTemplate(
        { cr: "2" },
        {},
        {
          name: "Reduced Threat",
          source: "TftYP",
          crMin: 2,
          apply: { _root: { size: ["M"] } },
        },
      );

      expect(child.size).toEqual(["M"]);
    });

    /** The Awakened template raises intelligence to 10, so a check after it never fails. */
    it("reads a prerequisite before apply._root writes over what it reads", () => {
      const awakened = {
        name: "Awakened",
        source: "PHB",
        prerequisite: { size: { max: "H" }, type: { oneOf: ["beast", "plant"] }, int: { max: 3 } },
        apply: { _root: { int: 10 } },
      };

      expect(underTemplate({ size: ["L"], type: "beast", int: 2 }, {}, awakened).int).toBe(10);
      expect(() => underTemplate({ size: ["L"], type: "beast", int: 8 }, {}, awakened)).toThrow(
        "its int is 8, over the template's 3",
      );
      expect(() => underTemplate({ size: ["G"], type: "beast", int: 2 }, {}, awakened)).toThrow(
        "it is size G, over H",
      );
      expect(() =>
        underTemplate({ size: ["L"], type: { type: "dragon" }, int: 2 }, {}, awakened),
      ).toThrow("it is a dragon, and the template takes beast or plant");
      // A bare "G" read as no sizes at all clears the very gate it fails.
      expect(() => underTemplate({ size: "G", type: "beast", int: 2 }, {}, awakened)).toThrow(
        "its size is string, and has to be a list",
      );
    });

    it("refuses a prerequisite nothing checks rather than applying the template anyway", () => {
      expect(() =>
        underTemplate(
          {},
          {},
          {
            name: "Awakened",
            source: "PHB",
            prerequisite: { alignment: { oneOf: ["L"] } },
            apply: { _root: {} },
          },
        ),
      ).toThrow("it has a prerequisite of alignment, which nothing checks");
    });
  });

  describe("the modes only a template uses", () => {
    it("adds a sense the creature lacks", () => {
      const child = underTemplate(
        {},
        {},
        whole("Deep Gnome", {
          mode: "addSenses",
          senses: { type: "darkvision", range: 120 },
        }),
      );

      expect(child.senses).toEqual(["darkvision 120 ft."]);
    });

    /**
     * The svirfneblin wererat sees 60 feet in rat form and 120 as a deep gnome,
     * and the parenthetical that says so is the half the range is edited around.
     */
    it("raises a range it already has, keeping what qualifies it", () => {
      const child = underTemplate(
        { senses: ["darkvision 60 ft. (rat form only)", "blindsight 30 ft."] },
        {},
        whole("Deep Gnome", { mode: "addSenses", senses: { type: "darkvision", range: 120 } }),
      );

      expect(child.senses).toEqual(["darkvision 120 ft. (rat form only)", "blindsight 30 ft."]);
    });

    it("leaves a longer range than the one it adds", () => {
      const child = underTemplate(
        { senses: ["darkvision 120 ft."] },
        {},
        whole("Goblin", { mode: "addSenses", senses: { type: "darkvision", range: 60 } }),
      );

      expect(child.senses).toEqual(["darkvision 120 ft."]);
    });

    it("refuses a sense list it cannot read rather than dropping what is there", () => {
      expect(() =>
        underTemplate(
          { senses: "darkvision 60 ft." },
          {},
          whole("Goblin", {
            mode: "addSenses",
            senses: { type: "darkvision", range: 120 },
          }),
        ),
      ).toThrow("addSenses needs a sense list, found string");
    });

    it("caps a size, and does not leave a creature two of one size", () => {
      const child = underTemplate(
        { size: ["H", "G"] },
        {},
        whole("Reduced Threat", {
          mode: "maxSize",
          max: "L",
        }),
      );

      expect(child.size).toEqual(["L"]);
    });

    /**
     * A creature states its rating and not its award, so halving one means
     * deriving it from the DMG's Experience Points by Challenge Rating first.
     */
    it("scales experience derived from the rating, and a lair award beside it", () => {
      const child = underTemplate(
        { cr: { cr: "13", lair: "14" } },
        {},
        whole("Reduced Threat", {
          mode: "scalarMultXp",
          scalar: 0.5,
          floor: true,
        }),
      );

      expect(child.cr).toEqual({ cr: "13", lair: "14", xp: 5000, xpLair: 5750 });
    });

    it("scales an award the creature states rather than deriving one", () => {
      const child = underTemplate(
        { cr: { cr: "13", xp: 1000 } },
        {},
        whole("Reduced Threat", {
          mode: "scalarMultXp",
          scalar: 0.5,
          floor: true,
        }),
      );

      expect(child.cr).toEqual({ cr: "13", xp: 500 });
    });

    it("shifts every value under a property, and writes a bonus back signed", () => {
      const child = underTemplate(
        { save: { con: "+6", int: "+8" }, skill: { perception: "+1" } },
        {},
        {
          name: "Reduced Threat",
          source: "TftYP",
          apply: {
            _mod: {
              save: { mode: "scalarAddProp", scalar: -2, prop: "*" },
              skill: { mode: "scalarAddProp", scalar: -2, prop: "perception" },
            },
          },
        },
      );

      expect(child.save).toEqual({ con: "+4", int: "+6" });
      expect(child.skill).toEqual({ perception: "-1" });
    });

    it("multiplies and wraps the two halves of a hit point block", () => {
      const child = underTemplate(
        { hp: { average: 135, formula: "18d10 + 36" } },
        {},
        {
          name: "Reduced Threat",
          source: "TftYP",
          apply: {
            _mod: {
              hp: [
                { mode: "scalarMultProp", prop: "average", scalar: 0.5, floor: true },
                {
                  mode: "prefixSuffixStringProp",
                  prop: "formula",
                  prefix: "floor((",
                  suffix: ") ÷ 2)",
                },
              ],
            },
          },
        },
      );

      expect(child.hp).toEqual({ average: 67, formula: "floor((18d10 + 36) ÷ 2)" });
    });

    it("shifts the attack and save numbers inside the prose that carries them", () => {
      const child = underTemplate(
        {
          action: [
            { name: "Bite", entries: ["{@atk mw} {@hit 7} to hit. Save {@dc 15}."] },
            { name: "Breath", entries: ["{@hit +4} to hit."] },
          ],
        },
        {},
        {
          name: "Reduced Threat",
          source: "TftYP",
          apply: {
            _mod: {
              action: [
                { mode: "scalarAddHit", scalar: -2 },
                { mode: "scalarAddDc", scalar: -2 },
              ],
            },
          },
        },
      );

      expect(child.action).toEqual([
        { name: "Bite", entries: ["{@atk mw} {@hit 5} to hit. Save {@dc 13}."] },
        { name: "Breath", entries: ["{@hit +2} to hit."] },
      ]);
    });

    /** `<$to_hit__str$>` is the only other thing upstream writes in a `{@hit}`. */
    it("refuses an operand it cannot shift rather than leaving it standing", () => {
      expect(() =>
        underTemplate(
          { action: [{ name: "Bite", entries: ["{@hit <$to_hit__str$>} to hit."] }] },
          {},
          {
            name: "Reduced Threat",
            source: "TftYP",
            apply: { _mod: { action: { mode: "scalarAddHit", scalar: -2 } } },
          },
        ),
      ).toThrow("scalarAddHit cannot shift {@hit <$to_hit__str$>}");
    });

    /**
     * The Reduced Threat template shifts `save`, `skill`, `legendary` and
     * `variant`, and the reduced basilisk has none of the four.
     */
    it("treats a property the creature lacks as nothing to scale", () => {
      const child = underTemplate(
        { cr: "3" },
        {},
        {
          name: "Reduced Threat",
          source: "TftYP",
          apply: {
            _mod: {
              save: { mode: "scalarAddProp", scalar: -2, prop: "*" },
              legendary: { mode: "scalarAddHit", scalar: -2 },
            },
          },
        },
      );

      expect(child.save).toBeUndefined();
      expect(child.legendary).toBeUndefined();
    });

    /** Upstream writes `hp.special` for a creature whose points are not rolled. */
    it("treats a key the property lacks the same way", () => {
      const child = underTemplate(
        { hp: { special: "equal to its summoner's" } },
        {},
        {
          name: "Reduced Threat",
          source: "TftYP",
          apply: {
            _mod: { hp: { mode: "scalarMultProp", prop: "average", scalar: 0.5, floor: true } },
          },
        },
      );

      expect(child.hp).toEqual({ special: "equal to its summoner's" });
    });

    it("refuses a value it cannot compute over, so a * cannot skip one in silence", () => {
      expect(() =>
        underTemplate(
          { skill: { perception: "+3", other: [{ oneOf: {} }] } },
          {},
          {
            name: "Reduced Threat",
            source: "TftYP",
            apply: { _mod: { skill: { mode: "scalarAddProp", scalar: -2, prop: "*" } } },
          },
        ),
      ).toThrow("scalarAddProp cannot edit skill.other");
    });

    /**
     * The Dracolich template drops "Amphibious", which only some of the dragons
     * it is applied to have.
     */
    it("waives a removal's check where the mod forces it", () => {
      const child = underTemplate(
        { trait: [{ name: "Legendary Resistance" }] },
        {},
        {
          name: "Dracolich",
          source: "MM",
          apply: { _mod: { trait: { mode: "removeArr", names: "Amphibious", force: true } } },
        },
      );

      expect(child.trait).toEqual([{ name: "Legendary Resistance" }]);
    });

    it("still refuses a removal that names nothing without force", () => {
      expect(() =>
        underTemplate(
          { trait: [{ name: "Legendary Resistance" }] },
          {},
          {
            name: "Dracolich",
            source: "MM",
            apply: { _mod: { trait: { mode: "removeArr", names: "Amphibious" } } },
          },
        ),
      ).toThrow('removeArr names "Amphibious", which trait does not hold');
    });
  });
});
