import type { FeatRecord, HomebrewFeatRecord } from "@dnd/catalog";
import { withImprovement } from "@dnd/character";
import { describe, expect, it } from "vitest";
import {
  type Candidate,
  candidateAt,
  featBarrier,
  improvementFeats,
  takesFeats,
} from "./improvementFeats.ts";

const feat = (name: string, source: string, json: object = {}): FeatRecord => ({
  name,
  source,
  edition: source === "XPHB" ? "one" : "classic",
  json: { name, source, ...json },
});

const FEATS = [
  feat("Ability Score Improvement", "XPHB", {
    category: "G",
    repeatable: true,
    prerequisite: [{ level: 4 }],
  }),
  feat("Alert", "XPHB", { category: "O" }),
  feat("Archery", "XPHB", { category: "FS", prerequisite: [{ feature: ["Fighting Style"] }] }),
  feat("Boon of Fate", "XPHB", { category: "EB", prerequisite: [{ level: 19 }] }),
  feat("Grappler", "XPHB", {
    category: "G",
    prerequisite: [
      { level: 4, ability: [{ str: 13 }] },
      { level: 4, ability: [{ dex: 13 }] },
    ],
  }),
];

const SCORES = { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 };
const at4: Candidate = {
  edition: "one",
  takesFeats: true,
  level: 4,
  classNames: ["Wizard"],
  scores: SCORES,
  totals: SCORES,
  held: [],
  earlier: [],
  race: { name: "human" },
  armor: ["light"],
  weapons: ["simple"],
  features: ["Spellcasting"],
  knowsSpells: false,
};
const names = (candidate: Candidate) => improvementFeats(FEATS, candidate).map(({ name }) => name);

describe("takesFeats", () => {
  it("allows feats under the 2024 rules whatever the option says, and under 2014 only by it", () => {
    expect(takesFeats({ edition: "one", houseRules: { feats: false } })).toBe(true);
    expect(takesFeats({ edition: "classic", houseRules: undefined })).toBe(false);
    expect(takesFeats({ edition: "classic", houseRules: { feats: true } })).toBe(true);
  });
});

describe("featBarrier", () => {
  const grappler = FEATS[4] as FeatRecord;
  it("names what stops a feat: no feats at all, a feat held already, then a prerequisite", () => {
    expect(featBarrier(grappler, { ...at4, takesFeats: false })).toBe("noFeats");
    expect(featBarrier(grappler, { ...at4, held: [grappler] })).toBe("held");
    expect(featBarrier(grappler, { ...at4, scores: { ...SCORES, dex: 12 } })).toBe("prerequisite");
    expect(featBarrier(grappler, at4)).toBeUndefined();
  });

  it("lets a repeatable feat be taken again", () => {
    const improvement = FEATS[0] as FeatRecord;
    expect(featBarrier(improvement, { ...at4, held: [improvement] })).toBeUndefined();
  });
});

describe("improvementFeats", () => {
  it("offers the general and origin feats a 2024 character qualifies for", () => {
    expect(names(at4)).toEqual(["Alert", "Grappler"]);
  });

  it("offers the boons at 19", () => {
    expect(names({ ...at4, level: 19 })).toEqual(["Alert", "Boon of Fate", "Grappler"]);
  });

  it("leaves out a feat whose scores fall short, unless the scores are unset", () => {
    const weak = { ...SCORES, dex: 12 };
    expect(names({ ...at4, scores: weak })).toEqual(["Alert"]);
    expect(names({ ...at4, scores: undefined })).toEqual(["Alert", "Grappler"]);
  });

  it("leaves out a feat held elsewhere that does not repeat", () => {
    expect(names({ ...at4, held: [{ name: "Alert", source: "XPHB" }] })).toEqual(["Grappler"]);
  });

  it("offers a classic feat whatever its category, by its prerequisites alone", () => {
    const classic = [
      feat("Grappler", "PHB", { prerequisite: [{ ability: [{ str: 13 }] }] }),
      feat("Ritual Caster", "PHB", { prerequisite: [{ ability: [{ int: 13 }, { wis: 13 }] }] }),
      feat("Tough", "PHB"),
    ];
    const scores = { ...SCORES, wis: 13 };
    expect(
      improvementFeats(classic, { ...at4, edition: "classic", scores }).map(({ name }) => name),
    ).toEqual(["Ritual Caster", "Tough"]);
    expect(improvementFeats(classic, { ...at4, edition: "classic", takesFeats: false })).toEqual(
      [],
    );
  });
});

describe("improvementFeats over homebrew feats", () => {
  const homebrew = (id: string, name: string, json: object = {}): HomebrewFeatRecord => ({
    id,
    name,
    edition: "one",
    json: { name, source: "HB", ...json },
    createdAt: "2026-10-28T00:00:00.000Z",
  });
  const offered = (feats: HomebrewFeatRecord[], candidate: Partial<Candidate> = {}) =>
    improvementFeats(feats, { ...at4, ...candidate }).map(({ name }) => name);

  it("narrows a homebrew feat by the category and prerequisites its entry carries", () => {
    expect(offered([homebrew("1", "Duelist's Edge", { category: "FS" })])).toEqual([]);
    expect(
      offered([
        homebrew("2", "Mighty Grip", { category: "G", prerequisite: [{ ability: [{ str: 15 }] }] }),
      ]),
    ).toEqual([]);
    expect(offered([homebrew("3", "Lucky Break")])).toEqual([]);
    expect(offered([homebrew("4", "Quick Study", { category: "O" })])).toEqual(["Quick Study"]);
  });

  it("refuses a homebrew feat held already that does not repeat", () => {
    const study = homebrew("4", "Quick Study", { category: "O" });
    expect(offered([study], { held: [{ homebrewId: "4" }] })).toEqual([]);
    expect(featBarrier(study, { ...at4, held: [{ homebrewId: "4" }] })).toBe("held");
  });
});

describe("improvementFeats prerequisites", () => {
  const gated = [
    feat("Dragon Fear", "XGE", { prerequisite: [{ race: [{ name: "dragonborn" }] }] }),
    feat("Fey Teleportation", "XGE", {
      prerequisite: [{ race: [{ name: "elf", subrace: "high" }] }],
    }),
    feat("Svirfneblin Magic", "MTF", {
      prerequisite: [{ race: [{ name: "gnome", subrace: "deep" }] }],
    }),
    feat("Squat Nimbleness", "XGE", {
      prerequisite: [{ race: [{ name: "dwarf" }, { name: "small race" }] }],
    }),
    feat("Heavy Armor Master", "PHB", { prerequisite: [{ proficiency: [{ armor: "heavy" }] }] }),
    feat("Shield Master", "XPHB", { prerequisite: [{ proficiency: [{ armor: "shield" }] }] }),
    feat("Purple Dragon Commandant", "FRHOF", {
      prerequisite: [
        { feat: ["purple dragon rook|frhof"] },
        { proficiency: [{ weaponGroup: "martial" }] },
      ],
    }),
    feat("War Caster", "PHB", { prerequisite: [{ spellcasting: true }] }),
    feat("Eldritch Adept", "TCE", { prerequisite: [{ spellcasting2020: true }] }),
    feat("Cartomancer", "BMT", { prerequisite: [{ spellcastingFeature: true }] }),
  ];
  const offered = (candidate: Partial<Candidate>) =>
    improvementFeats(gated, { ...at4, edition: "classic", ...candidate }).map(({ name }) => name);
  const always = ["Squat Nimbleness"];

  it("offers a race's feats to that race, by its base name or with its subrace", () => {
    expect(offered({ race: { name: "dragonborn (chromatic)" }, features: [] })).toEqual([
      "Dragon Fear",
      ...always,
    ]);
    expect(offered({ race: { name: "elf", subrace: "high" }, features: [] })).toEqual([
      "Fey Teleportation",
      ...always,
    ]);
    expect(offered({ race: { name: "gnome (deep)" }, features: [] })).toEqual([
      "Svirfneblin Magic",
      ...always,
    ]);
    expect(offered({ features: [] })).toEqual(always);
  });

  it("offers an armor or weapon feat to a character proficient in it", () => {
    const fighter = { features: [], armor: ["heavy", "shield"], weapons: ["martial"] };
    expect(offered(fighter)).toEqual([
      "Squat Nimbleness",
      "Heavy Armor Master",
      "Shield Master",
      "Purple Dragon Commandant",
    ]);
  });

  it("offers a feat that needs another to a character who took it at an earlier level", () => {
    expect(offered({ features: [], earlier: ["purple dragon rook|frhof"] })).toEqual([
      ...always,
      "Purple Dragon Commandant",
    ]);
  });

  it("reads spellcasting off a feature, Pact Magic or a known spell, as each kind asks", () => {
    const at = (candidate: Partial<Candidate>) =>
      offered({ ...candidate }).filter((name) => !always.includes(name));
    expect(at({ features: ["Spellcasting"] })).toEqual([
      "War Caster",
      "Eldritch Adept",
      "Cartomancer",
    ]);
    expect(at({ features: ["Pact Magic"] })).toEqual(["War Caster", "Eldritch Adept"]);
    expect(at({ features: [], knowsSpells: true })).toEqual(["War Caster"]);
    expect(at({ features: [] })).toEqual([]);
  });

  it("refuses nothing on a race or proficiencies not yet set", () => {
    expect(
      offered({ race: undefined, armor: undefined, weapons: undefined, features: [] }),
    ).toEqual([
      "Dragon Fear",
      "Fey Teleportation",
      "Svirfneblin Magic",
      "Squat Nimbleness",
      "Heavy Armor Master",
      "Shield Master",
      "Purple Dragon Commandant",
    ]);
  });
});

describe("candidateAt", () => {
  it("reads the scores and classes reached by the level, and every other increase for the cap", () => {
    const WIZARD = { name: "Wizard", source: "XPHB" };
    const FIGHTER = { name: "Fighter", source: "XPHB" };
    const levels = [...Array.from({ length: 8 }, () => ({ class: WIZARD })), { class: FIGHTER }];
    const none = { feats: [], abilityIncreases: [] };
    const raised = withImprovement(none, 8, WIZARD, {
      increases: [{ ability: "str", amount: 2 }],
    });
    const candidate = candidateAt(
      {
        edition: "classic",
        levels,
        abilityScores: { ...SCORES, str: 12 },
        houseRules: { feats: true },
        ...raised,
      },
      { level: 4, features: [] },
    );
    expect(candidate.takesFeats).toBe(true);
    expect(candidate.scores?.str).toBe(12);
    expect(candidate.totals?.str).toBe(14);
    expect(candidate.classNames).toEqual(["Wizard", "Wizard", "Wizard", "Wizard"]);
  });

  it("counts the increase of a feat taken outside an improvement toward scores and the cap", () => {
    const WIZARD = { name: "Wizard", source: "XPHB" };
    const INFERNAL = { name: "Infernal Constitution", source: "XGE" };
    const candidate = candidateAt(
      {
        edition: "classic",
        levels: Array.from({ length: 4 }, () => ({ class: WIZARD })),
        abilityScores: { ...SCORES, con: 12 },
        houseRules: { feats: true },
        feats: [{ ref: INFERNAL, picks: { ability: [{ ability: "con", amount: 1 }] } }],
        abilityIncreases: [],
      },
      { level: 4, features: [] },
    );
    expect(candidate.scores?.con).toBe(13);
    expect(candidate.totals?.con).toBe(13);
  });

  it("reads the race, proficiencies and the feats taken before the level", () => {
    const WIZARD = { name: "Wizard", source: "PHB" };
    const levels = Array.from({ length: 8 }, () => ({ class: WIZARD }));
    const rook = { name: "Purple Dragon Rook", source: "FRHoF" };
    const later = { name: "Alert", source: "PHB" };
    const definition = {
      edition: "classic" as const,
      levels,
      abilityScores: SCORES,
      houseRules: { feats: true },
      abilityIncreases: [],
      feats: [{ ref: rook }, { ref: later, level: 8 }],
      race: { name: "Elf", source: "PHB" },
      subrace: { name: "High", source: "PHB" },
      proficiencies: { armor: ["Heavy Armor", "Shields"], weapons: ["Martial weapons"] },
      spells: [],
    };
    const grant = { level: 4, cls: WIZARD, classLevel: 4, boon: false, features: ["Spellcasting"] };
    const candidate = candidateAt(definition, grant);
    expect(candidate.earlier).toEqual(["purple dragon rook|frhof"]);
    expect(candidate.race).toEqual({ name: "elf", subrace: "high" });
    expect(candidate.armor).toEqual(["heavy", "shield"]);
    expect(candidate.weapons).toEqual(["martial"]);
    expect(candidate.features).toEqual(["Spellcasting"]);
    expect(candidate.knowsSpells).toBe(false);
    const homebrew = { ...definition, race: { homebrewId: "h1" }, subrace: undefined };
    expect(candidateAt(homebrew, grant).race).toBeUndefined();
  });
});
