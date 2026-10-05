import { describe, expect, it } from "vitest";
import { catalogRowEntries } from "./index.ts";

// Every field but the prose is upstream's own, at the pinned tag: the prose is WotC's.
const GOBLIN_MM = {
  name: "Goblin",
  source: "MM",
  size: ["S"],
  type: { type: "humanoid", tags: ["goblinoid"] },
  alignment: ["N", "E"],
  ac: [{ ac: 15, from: ["{@item leather armor|phb}", "{@item shield|phb}"] }],
  hp: { average: 7, formula: "2d6" },
  speed: { walk: 30 },
  str: 8,
  dex: 14,
  con: 10,
  int: 10,
  wis: 8,
  cha: 8,
  skill: { stealth: "+6" },
  senses: ["darkvision 60 ft."],
  passive: 9,
  languages: ["Common", "Goblin"],
  cr: "1/4",
  trait: [{ name: "Nimble Escape", entries: ["Escapes."] }],
  action: [
    { name: "Scimitar", entries: ["{@atk mw} {@hit 4} to hit."] },
    { name: "Shortbow", entries: ["{@atk rw} {@hit 4} to hit."] },
  ],
};

const GOBLIN_WARRIOR_XMM = {
  name: "Goblin Warrior",
  source: "XMM",
  size: ["S"],
  type: { type: "fey", tags: ["goblinoid"] },
  alignment: ["C", "N"],
  ac: [15],
  hp: { average: 10, formula: "3d6" },
  speed: { walk: 30 },
  str: 8,
  dex: 15,
  con: 10,
  int: 10,
  wis: 8,
  cha: 8,
  skill: { stealth: "+6" },
  senses: ["Darkvision 60 ft."],
  passive: 9,
  languages: ["Common", "Goblin"],
  cr: "1/4",
  action: [{ name: "Scimitar", entries: ["{@atkr m} {@hit 4}, reach 5 ft."] }],
  bonus: [{ name: "Nimble Escape", entries: ["Disengages or hides."] }],
};

const ABOLETH_MM = {
  name: "Aboleth",
  source: "MM",
  size: ["L"],
  type: "aberration",
  alignment: ["L", "E"],
  ac: [{ ac: 17, from: ["natural armor"] }],
  hp: { average: 135, formula: "18d10 + 36" },
  speed: { walk: 10, swim: 40 },
  str: 21,
  dex: 9,
  con: 15,
  int: 18,
  wis: 15,
  cha: 18,
  save: { con: "+6", int: "+8", wis: "+6" },
  skill: { history: "+12", perception: "+10" },
  senses: ["darkvision 120 ft."],
  passive: 20,
  languages: ["Deep Speech", "telepathy 120 ft."],
  cr: "10",
  action: [{ name: "Tail", entries: ["Swipes."] }],
  legendary: [
    { name: "Detect", entries: ["Looks."] },
    { name: "Psychic Drain (Costs 2 Actions)", entries: ["Drains."] },
  ],
  legendaryGroup: { name: "Aboleth", source: "MM" },
};

const monster = (json: Record<string, unknown>) => catalogRowEntries("monster", json);

const named = (entries: unknown[]) =>
  entries.flatMap((entry) =>
    typeof entry === "object" && entry !== null && "name" in entry ? [entry.name] : [],
  );

describe("a monster's stat block", () => {
  it("reads a 2014 monster's lines in printed order, then its traits and actions", () => {
    const entries = monster(GOBLIN_MM);
    expect(entries.filter((entry) => typeof entry === "string")).toEqual([
      "{@i Small humanoid (goblinoid), neutral evil}",
      "{@b Armor Class} 15 ({@item leather armor|phb}, {@item shield|phb})",
      "{@b Hit Points} 7 (2d6)",
      "{@b Speed} 30 ft.",
      "{@b Skills} Stealth +6",
      "{@b Senses} darkvision 60 ft., passive Perception 9",
      "{@b Languages} Common, Goblin",
      "{@b Challenge} 1/4",
    ]);
    expect(entries[4]).toEqual({
      type: "table",
      colLabels: ["STR", "DEX", "CON", "INT", "WIS", "CHA"],
      rows: [["8 (-1)", "14 (+2)", "10 (+0)", "10 (+0)", "8 (-1)", "8 (-1)"]],
    });
    expect(named(entries)).toEqual(["Traits", "Actions"]);
    expect(entries.at(-1)).toEqual({
      type: "entries",
      name: "Actions",
      entries: [
        { type: "entries", name: "Scimitar", entries: ["{@atk mw} {@hit 4} to hit."] },
        { type: "entries", name: "Shortbow", entries: ["{@atk rw} {@hit 4} to hit."] },
      ],
    });
  });

  it("reads a 2024 monster's bare armor class and its bonus actions", () => {
    const entries = monster(GOBLIN_WARRIOR_XMM);
    expect(entries.slice(0, 2)).toEqual([
      "{@i Small fey (goblinoid), chaotic neutral}",
      "{@b Armor Class} 15",
    ]);
    expect(entries).toContain("{@b Senses} Darkvision 60 ft., passive Perception 9");
    expect(named(entries)).toEqual(["Actions", "Bonus Actions"]);
  });

  it("heads legendary actions with their uses, and links the legendary group", () => {
    const entries = monster(ABOLETH_MM);
    expect(entries).toContain("{@b Speed} 10 ft., swim 40 ft.");
    expect(entries).toContain("{@b Saving Throws} Con +6, Int +8, Wis +6");
    expect(entries).toContain("{@b Skills} History +12, Perception +10");
    expect(named(entries)).toEqual(["Actions", "Legendary Actions"]);
    expect(entries.at(-2)).toMatchObject({
      name: "Legendary Actions",
      entries: [
        "Legendary action uses: 3.",
        { name: "Detect" },
        { name: "Psychic Drain (Costs 2 Actions)" },
      ],
    });
    expect(entries.at(-1)).toBe("{@b Lair Actions and Regional Effects} {@legroup Aboleth|MM}");
  });

  it("counts a lair's extra legendary action uses, and prefers upstream's own header", () => {
    const legendary = [{ name: "Lash", entries: ["Lashes."] }];
    expect(monster({ legendary, legendaryActionsLair: 4 })[0]).toMatchObject({
      entries: ["Legendary action uses: 3 (4 in its lair).", { name: "Lash" }],
    });
    expect(monster({ legendary, legendaryHeader: ["Own header."] })[0]).toMatchObject({
      entries: ["Own header.", { name: "Lash" }],
    });
  });

  it("leaves out every line a monster lacks, as Jenks (WDH) lacks all but a size and type", () => {
    const jenks = {
      name: "Jenks",
      source: "WDH",
      size: ["S"],
      type: { type: "humanoid", tags: ["human"] },
    };
    expect(monster(jenks)).toEqual(["{@i Small humanoid (human)}"]);
  });

  it.each([
    [["L", "NX", "C", "E"], "any evil alignment"],
    [["L", "NX", "C", "NY", "E"], "any non-good alignment"],
    [["C", "G", "NY", "E"], "any chaotic alignment"],
    [["U"], "unaligned"],
    [["A"], "any alignment"],
    [
      [
        { alignment: ["C", "G"], chance: 75 },
        { alignment: ["N", "E"], chance: 25 },
      ],
      "chaotic good (75%) or neutral evil (25%)",
    ],
    [[{ special: "lawful grumpy" }], "lawful grumpy"],
  ])("reads the alignment %j as %s", (alignment, words) => {
    expect(monster({ alignment })[0]).toBe(
      `{@i ${words.charAt(0).toUpperCase()}${words.slice(1)}}`,
    );
  });

  it("reads a swarm, a typical alignment, a choice of types and a tag's prefix", () => {
    const swarm = { size: ["M"], type: { type: "beast", swarmSize: "T" }, alignment: ["U"] };
    expect(monster(swarm)[0]).toBe("{@i Medium swarm of Tiny beasts, unaligned}");
    const typical = { size: ["M"], type: "fey", alignmentPrefix: "typically ", alignment: ["N"] };
    expect(monster(typical)[0]).toBe("{@i Medium fey, typically neutral}");
    expect(monster({ type: { type: { choose: ["celestial", "fiend"] } } })[0]).toBe(
      "{@i Celestial or fiend}",
    );
    const dwarves = {
      type: {
        type: "humanoid",
        tags: [
          { tag: "dwarf", prefix: "Shield" },
          { tag: "dwarf", prefix: "Hill", prefixHidden: true },
        ],
      },
    };
    expect(monster(dwarves)[0]).toBe("{@i Humanoid (Shield dwarf, dwarf)}");
  });

  it("brackets a conditional armor class after the one it qualifies", () => {
    const ac = [12, { ac: 15, condition: "with {@spell mage armor}", braces: true }];
    expect(monster({ ac })).toEqual(["{@b Armor Class} 12 (15 with {@spell mage armor})"]);
    expect(monster({ ac: [{ special: "11 + the spell's level" }] })).toEqual([
      "{@b Armor Class} 11 + the spell's level",
    ]);
  });

  it("reads hit points that are a formula alone", () => {
    expect(monster({ hp: { special: "40 + 10 for each spell level above 4th" } })).toEqual([
      "{@b Hit Points} 40 + 10 for each spell level above 4th",
    ]);
  });

  it("reads hovering, conditional, alternate and chosen speeds", () => {
    const speed = {
      walk: 30,
      alternate: { walk: [{ number: 50, condition: "(panther form only)" }] },
      fly: 60,
      canHover: true,
      swim: { number: 20, condition: "(in water)" },
      choose: { from: ["climb", "fly"], amount: 20, note: "(DM's choice)" },
    };
    expect(monster({ speed })).toEqual([
      "{@b Speed} 30 ft., 50 ft. (panther form only), fly 60 ft. (hover), swim 20 ft. (in water), climb or fly 20 ft. (DM's choice)",
    ]);
  });

  it("parts a qualified group of damage types from the plain ones with a semicolon", () => {
    const immune = [
      "poison",
      {
        immune: ["bludgeoning", "piercing", "slashing"],
        note: "from nonmagical attacks",
        cond: true,
      },
    ];
    expect(monster({ immune })).toEqual([
      "{@b Damage Immunities} poison; bludgeoning, piercing, slashing from nonmagical attacks",
    ]);
    expect(monster({ conditionImmune: ["charmed", "frightened"] })).toEqual([
      "{@b Condition Immunities} charmed, frightened",
    ]);
  });

  it("offers a skill choice, and reads a challenge raised in a lair", () => {
    const skill = { arcana: "+7", other: [{ oneOf: { history: "+7", religion: "+7" } }] };
    expect(monster({ skill })).toEqual([
      "{@b Skills} Arcana +7, plus one of the following: History +7, Religion +7",
    ]);
    expect(monster({ cr: { cr: "21", lair: "22" } })).toEqual([
      "{@b Challenge} 21 (or 22 in its lair)",
    ]);
  });

  it("lists spells by frequency and by level, under the section its display names", () => {
    const spellcasting = [
      {
        name: "Spellcasting",
        headerEntries: ["Casts."],
        will: ["{@spell light}", { entry: "{@spell fire bolt}", hidden: true }],
        daily: { "1e": ["{@spell scrying}"], "2e": ["{@spell fly}", "{@spell haste}"] },
        spells: {
          "0": { spells: ["{@spell mage hand}"] },
          "9": { slots: 1, spells: ["{@spell wish}"] },
        },
        displayAs: "action",
      },
      {
        name: "Misty Step (3/Day)",
        headerEntries: ["Steps."],
        daily: { "3": ["{@spell misty step}"] },
        hidden: ["daily"],
        displayAs: "bonus",
      },
    ];
    const entries = monster({ spellcasting });
    expect(named(entries)).toEqual(["Actions", "Bonus Actions"]);
    expect(entries[0]).toEqual({
      type: "entries",
      name: "Actions",
      entries: [
        {
          type: "entries",
          name: "Spellcasting",
          entries: [
            "Casts.",
            {
              type: "list",
              style: "list-hang-notitle",
              items: [
                { type: "item", name: "At will:", entry: "{@spell light}" },
                { type: "item", name: "2/day each:", entry: "{@spell fly}, {@spell haste}" },
                { type: "item", name: "1/day each:", entry: "{@spell scrying}" },
                { type: "item", name: "Cantrips (at will):", entry: "{@spell mage hand}" },
                { type: "item", name: "9th level (1 slot):", entry: "{@spell wish}" },
              ],
            },
          ],
        },
      ],
    });
    expect(entries[1]).toEqual({
      type: "entries",
      name: "Bonus Actions",
      entries: [{ type: "entries", name: "Misty Step (3/Day)", entries: ["Steps."] }],
    });
  });

  it("lists rituals, and spells cast from an item's charges", () => {
    const spellcasting = [
      { name: "Spellcasting", ritual: ["{@spell knock}"] },
      {
        name: "Wand Spellcasting",
        charges: { "1e": ["{@spell finger of death}"], "2e": ["{@spell power word kill}"] },
      },
    ];
    const [traits] = monster({ spellcasting });
    expect(JSON.stringify(traits)).toContain('"name":"Rituals:","entry":"{@spell knock}"');
    expect(JSON.stringify(traits)).toContain(
      '"name":"2 charges each:","entry":"{@spell power word kill}"},{"type":"item","name":"1 charge each:"',
    );
  });

  it("joins spellcasting with no display to the traits", () => {
    const spellcasting = [{ name: "Innate Spellcasting", will: ["{@spell light}"] }];
    expect(
      named(monster({ trait: [{ name: "Amphibious", entries: ["Breathes."] }], spellcasting })),
    ).toEqual(["Traits"]);
  });
});

describe("a legendary group", () => {
  it("shows its lair actions, regional effects and mythic encounter, leaving out what it lacks", () => {
    expect(
      catalogRowEntries("legendaryGroup", {
        name: "Aboleth",
        source: "MM",
        lairActions: ["Lair."],
        regionalEffects: ["Region."],
      }),
    ).toEqual([
      { type: "entries", name: "Lair Actions", entries: ["Lair."] },
      { type: "entries", name: "Regional Effects", entries: ["Region."] },
    ]);
    expect(catalogRowEntries("legendaryGroup", { mythicEncounter: ["Mythic."] })).toEqual([
      { type: "entries", name: "Mythic Encounter", entries: ["Mythic."] },
    ]);
  });
});

describe("catalogRowEntries", () => {
  it("renders a table as itself, and any other row as its entries", () => {
    expect(catalogRowEntries("table", { rows: [["1"]] })).toEqual([
      { rows: [["1"]], type: "table" },
    ]);
    expect(catalogRowEntries("condition", { entries: ["Blinded."] })).toEqual(["Blinded."]);
    expect(catalogRowEntries("book", {})).toEqual([]);
  });
});
