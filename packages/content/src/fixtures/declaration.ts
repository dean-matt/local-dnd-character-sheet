/**
 * What each file under `tests/fixtures/5etools/` keeps of its upstream counterpart.
 *
 * Read by `build.ts`, which copies the named entries, fields and columns out of
 * `vendor/` verbatim. Nothing here is a value: an entry is addressed by identity,
 * a column by its upstream label. The exception is an `Override` — a `set` field or
 * an invented element — which carries a value upstream does not have and says why.
 *
 * Adding coverage means naming another entry or field here and rebuilding, never
 * editing the JSON. A name upstream no longer carries fails the build.
 */

import type { Selection } from "./select.ts";

export type Fixture = { file: string; keep: Selection };

const BOOK_FIELDS = ["name", "id", "source", "group", "published"];

const CLASS_FIELDS = [
  "name",
  "source",
  "page",
  "edition",
  "hd",
  "spellcastingAbility",
  "casterProgression",
  "classTableGroups",
  "classFeatures",
];

const CLERIC_SLOT_COLS = [
  "{@filter 1st|spells|level=1|class=Cleric}",
  "{@filter 2nd|spells|level=2|class=Cleric}",
];

const SPELL_FIELDS = [
  "name",
  "source",
  "page",
  "level",
  "school",
  "time",
  "range",
  "components",
  "duration",
  "entries",
];

export const FIXTURES: Fixture[] = [
  {
    file: "data/actions.json",
    keep: { within: { action: { items: ["Dash|PHB", "Dash|XPHB"] } } },
  },
  {
    file: "data/adventures.json",
    keep: {
      within: {
        adventure: {
          items: [
            { id: "Lost Mine of Phandelver|LMoP|LMoP", fields: BOOK_FIELDS },
            { id: "Heroes of the Borderlands|HotB|HotB", fields: BOOK_FIELDS },
            {
              id: "Stranger Things: Welcome to the Hellfire Club|WttHC|WttHC",
              fields: BOOK_FIELDS,
            },
          ],
        },
      },
    },
  },
  {
    file: "data/backgrounds.json",
    keep: {
      within: {
        background: {
          items: [
            {
              id: "Acolyte|PHB",
              fields: [
                "name",
                "source",
                "page",
                "srd",
                "basicRules",
                "skillProficiencies",
                "entries",
              ],
            },
            { id: "Baldur's Gate Acolyte|BGDIA", fields: ["name", "source", "page", "_copy"] },
            {
              id: "Criminal|PHB",
              fields: ["name", "source", "page", "basicRules", "skillProficiencies", "entries"],
            },
            {
              id: "Variant Criminal (Spy)|PHB",
              fields: ["name", "source", "page", "basicRules", "_copy"],
            },
            { id: "Augen Trust (Spy)|EGW", fields: ["name", "source", "page", "_copy"] },
            "Acolyte|XPHB",
          ],
        },
      },
    },
  },
  {
    file: "data/books.json",
    keep: {
      within: {
        book: {
          items: [
            { id: "Player's Handbook (2014)|PHB|PHB", fields: BOOK_FIELDS },
            { id: "Puncheons and Flagons|PaF|PaF", fields: BOOK_FIELDS },
            { id: "Player's Handbook (2024)|XPHB|XPHB", fields: BOOK_FIELDS },
            { id: "Dungeon Master's Guide (2024)|XDMG|XDMG", fields: BOOK_FIELDS },
          ],
        },
      },
    },
  },
  {
    file: "data/class/class-artificer.json",
    keep: {
      fields: ["class"],
      within: {
        class: {
          items: [
            {
              id: "Artificer|TCE",
              fields: [
                "name",
                "source",
                "page",
                "edition",
                "hd",
                "spellcastingAbility",
                "optionalfeatureProgression",
                "classTableGroups",
                "classFeatures",
              ],
              within: {
                classTableGroups: { items: [0] },
                classFeatures: { items: ["Magical Tinkering|Artificer|TCE|1"] },
              },
            },
          ],
        },
      },
    },
  },
  {
    file: "data/class/class-cleric.json",
    keep: {
      within: {
        class: {
          items: [
            {
              id: "Cleric|PHB",
              fields: CLASS_FIELDS,
              within: {
                classTableGroups: { items: [0, { id: 1, cols: CLERIC_SLOT_COLS }] },
                classFeatures: { items: ["Spellcasting|Cleric||1", "Channel Divinity|Cleric||2"] },
              },
            },
            {
              id: "Cleric|XPHB",
              fields: CLASS_FIELDS,
              within: {
                classTableGroups: {
                  items: [
                    {
                      id: 0,
                      cols: ["Channel Divinity", "{@filter Cantrips|spells|level=0|class=Cleric}"],
                    },
                    { id: 1, cols: CLERIC_SLOT_COLS },
                  ],
                },
                classFeatures: {
                  items: ["Spellcasting|Cleric|XPHB|1", "Channel Divinity|Cleric|XPHB|2"],
                },
              },
            },
          ],
        },
        subclass: {
          items: [
            {
              id: "Knowledge Domain|PHB|Cleric|PHB",
              fields: [
                "name",
                "shortName",
                "source",
                "className",
                "classSource",
                "page",
                "reprintedAs",
                "subclassFeatures",
              ],
              within: {
                subclassFeatures: {
                  items: [
                    "Knowledge Domain|Cleric||Knowledge||1",
                    "Visions of the Past|Cleric||Knowledge||17",
                  ],
                },
              },
              set: {
                isReprinted: {
                  value: true,
                  why: "Upstream leaves the flag to its renderer, so no fetched row carries one. The loader has to see it set on the superseded printing to prove it does not copy it onto the printing that supersedes it.",
                },
              },
            },
            {
              id: "Knowledge Domain|PHB|Cleric|XPHB",
              within: {
                subclassFeatures: {
                  items: [
                    "Knowledge Domain|Cleric|XPHB|Knowledge||3",
                    "Visions of the Past|Cleric||Knowledge||17",
                  ],
                },
                _copy: { within: { _preserve: { fields: ["page", "reprintedAs"] } } },
              },
            },
            {
              id: "Death Domain|DMG|Cleric|PHB",
              within: { subclassFeatures: { items: ["Death Domain|Cleric||Death|DMG|1"] } },
            },
            {
              id: "Death Domain|DMG|Cleric|XPHB",
              within: { subclassFeatures: { items: ["Death Domain|Cleric|XPHB|Death|DMG|3"] } },
            },
          ],
        },
        subclassFeature: {
          items: [
            {
              id: "Channel Divinity: Touch of Death|DMG|Cleric|PHB|Death|DMG|2",
              fields: [
                "name",
                "source",
                "page",
                "className",
                "classSource",
                "subclassShortName",
                "subclassSource",
                "level",
                "header",
                "entries",
              ],
            },
            "Channel Divinity: Touch of Death|DMG|Cleric|XPHB|Death|DMG|3",
          ],
        },
        classFeature: {
          items: [
            "Ability Score Improvement|PHB|Cleric|PHB|4",
            "Ability Score Improvement|PHB|Cleric|PHB|8",
            "Ability Score Improvement|XPHB|Cleric|XPHB|4",
          ],
        },
      },
    },
  },
  {
    file: "data/class/class-fighter.json",
    keep: {
      fields: ["class", "subclass", "classFeature"],
      within: {
        class: {
          items: [
            {
              id: "Fighter|XPHB",
              fields: [
                "name",
                "source",
                "page",
                "edition",
                "hd",
                "classTableGroups",
                "classFeatures",
              ],
              within: { classFeatures: { items: ["Second Wind|Fighter|XPHB|1"] } },
            },
          ],
        },
        subclass: {
          items: [
            {
              id: "Psi Warrior|XPHB|Fighter|XPHB",
              fields: [
                "name",
                "shortName",
                "source",
                "className",
                "classSource",
                "page",
                "edition",
                "subclassTableGroups",
                "subclassFeatures",
              ],
              within: {
                subclassFeatures: { items: ["Psi Warrior|Fighter|XPHB|Psi Warrior|XPHB|3"] },
              },
            },
            {
              id: "Eldritch Knight|XPHB|Fighter|XPHB",
              fields: [
                "name",
                "shortName",
                "source",
                "className",
                "classSource",
                "page",
                "edition",
                "spellcastingAbility",
                "casterProgression",
                "subclassTableGroups",
                "subclassFeatures",
              ],
              within: {
                subclassTableGroups: {
                  items: [
                    0,
                    {
                      id: 1,
                      cols: [
                        "{@filter 1st|spells|level=1|subclass=Fighter: Eldritch Knight}",
                        "{@filter 2nd|spells|level=2|subclass=Fighter: Eldritch Knight}",
                      ],
                    },
                  ],
                },
                subclassFeatures: {
                  items: ["Eldritch Knight|Fighter|XPHB|Eldritch Knight|XPHB|3"],
                },
              },
            },
            {
              id: "Battle Master|XPHB|Fighter|XPHB",
              fields: [
                "name",
                "shortName",
                "source",
                "className",
                "classSource",
                "page",
                "edition",
                "optionalfeatureProgression",
              ],
            },
          ],
        },
        classFeature: { items: ["Ability Score Improvement|XPHB|Fighter|XPHB|4"] },
      },
    },
  },
  {
    file: "data/class/class-sidekick.json",
    keep: {
      within: {
        class: {
          items: [
            {
              id: "Expert Sidekick|TCE",
              fields: ["name", "source", "page", "edition", "isSidekick", "classFeatures"],
              within: { classFeatures: { items: ["Bonus Proficiencies|Expert Sidekick|TCE|1"] } },
            },
          ],
        },
        classFeature: {
          items: [
            {
              id: "Bonus Proficiencies|TCE|Expert Sidekick|TCE|1",
              within: { entries: { items: [0] } },
            },
          ],
        },
      },
    },
  },
  {
    file: "data/class/class-warlock.json",
    keep: {
      fields: ["class"],
      within: {
        class: {
          items: [
            {
              id: "Warlock|PHB",
              fields: [
                "name",
                "source",
                "page",
                "edition",
                "hd",
                "spellcastingAbility",
                "casterProgression",
                "optionalfeatureProgression",
                "classTableGroups",
                "classFeatures",
              ],
              within: {
                classTableGroups: {
                  items: [
                    {
                      id: 0,
                      cols: [
                        "{@filter Cantrips Known|spells|level=0|class=Warlock}",
                        "Spell Slots",
                        "Slot Level",
                        "{@filter Invocations Known|optionalfeatures|feature type=ei}",
                      ],
                    },
                  ],
                },
                classFeatures: { items: ["Pact Magic|Warlock||1"] },
              },
            },
          ],
        },
      },
    },
  },
  {
    file: "data/conditionsdiseases.json",
    keep: {
      within: {
        condition: { items: ["Blinded|PHB", "Blinded|XPHB"] },
        disease: { items: ["Blinding Sickness|PHB"] },
        status: { items: ["Bloodied|XPHB"] },
      },
    },
  },
  {
    file: "data/deities.json",
    keep: {
      within: {
        deity: {
          items: [
            "Oghma|PHB|Celtic",
            "Oghma|PHB|Forgotten Realms",
            "Moradin|PHB|Nonhuman",
            "Bahgtru|SCAG|Orc",
            "Bahgtru|VGM|Orc",
          ],
        },
      },
    },
  },
  {
    file: "data/feats.json",
    keep: {
      within: {
        feat: {
          items: [
            "Alert|PHB",
            "Alert|XPHB",
            {
              id: "Magic Initiate|XPHB",
              within: {
                _versions: {
                  items: ["Magic Initiate; Cleric|XPHB", "Magic Initiate; Druid|XPHB"],
                },
              },
            },
            "Martial Adept|PHB",
          ],
        },
      },
    },
  },
  {
    file: "data/generated/gendata-tag-redirects.json",
    keep: {
      fields: ["actions.html", "skill"],
      within: {
        "actions.html": { fields: ["dash_phb", "grapple_phb"] },
        skill: { fields: ["acrobatics_phb", "animal%20handling_phb"] },
      },
    },
  },
  {
    file: "data/items.json",
    keep: {
      fields: ["_meta", "item", "itemGroup"],
      within: {
        item: {
          items: [
            "Slumbering Dragon Vessel|FTD",
            "Stirring Dragon Vessel|FTD",
            "Wakened Dragon Vessel|FTD",
            "Ascendant Dragon Vessel|FTD",
            {
              id: "Wand of Magic Missiles|DMG",
              fields: ["name", "source", "page", "srd", "type", "rarity", "charges", "entries"],
            },
            "Charred Wand of Magic Missiles|WDH",
            "Bag of Holding|DMG",
            "+1 Wand of the War Mage|DMG",
            "Dragon Thighbone Club|SKT",
            "Borderlands Tabard|HotB",
            "Cloak of Billowing|XDMG",
            "Cloak of Billowing|WttHC",
          ],
        },
        itemGroup: { items: [{ id: "Arcane Focus|PHB", verbatim: ["focus"] }] },
      },
    },
  },
  {
    file: "data/items-base.json",
    keep: {
      fields: [
        "_meta",
        "baseitem",
        "itemProperty",
        "itemType",
        "itemMastery",
        "itemEntry",
        "itemTypeAdditionalEntries",
      ],
      within: {
        baseitem: {
          items: ["Longsword|PHB", "Longsword|XPHB", "Alchemist's Supplies|PHB"],
        },
        itemProperty: { items: ["PHB|2H", "XPHB|2H", "special|PHB|S"] },
        itemType: {
          items: ["Vehicle (Water)|DMG|SHP", "Vehicle (Air)|DMG|AIR", "Melee Weapon|XPHB|M"],
        },
        itemMastery: { items: ["Cleave|XPHB"] },
        itemEntry: {
          items: [{ id: "Armor of Resistance|DMG", prose: ["entriesTemplate"] }],
        },
        itemTypeAdditionalEntries: { items: ["Gaming Set|XGE"] },
      },
    },
  },
  {
    file: "data/magicvariants.json",
    keep: {
      fields: ["magicvariant"],
      within: {
        magicvariant: {
          items: ["Arrow of Slaying (*)", "Ammunition of Slaying", "Armblade"],
        },
      },
    },
  },
  {
    file: "data/languages.json",
    keep: {
      within: {
        language: { items: ["Common|PHB", "Draconic|PHB", "Common|XPHB"] },
        languageScript: { items: ["Draconic|PHB"] },
      },
    },
  },
  {
    file: "data/optionalfeatures.json",
    keep: {
      within: {
        optionalfeature: {
          items: [
            "Dueling|PHB",
            "Archery|PHB",
            "Agonizing Blast|XPHB",
            {
              id: "Agonizing Blast|PHB",
              fields: ["name", "source", "page", "featureType", "prerequisite", "entries"],
            },
            { id: "Ambush|XPHB", fields: ["name", "source", "page", "featureType", "entries"] },
            {
              id: "Pact of the Chain|PHB",
              fields: ["name", "source", "page", "featureType", "entries"],
              within: { entries: { items: [0] } },
            },
            {
              id: "Arcane Propulsion Armor|TCE",
              fields: ["name", "source", "page", "featureType", "entries"],
              within: { entries: { items: [0] } },
            },
            "Superior Technique|TCE",
            "Riposte|PHB",
          ],
        },
      },
    },
  },
  {
    file: "data/psionics.json",
    keep: { within: { psionic: { items: ["Mastery of Force|UATheMysticClass"] } } },
  },
  {
    file: "data/races.json",
    keep: {
      within: {
        race: {
          items: [
            {
              id: "Goblin|MPMM",
              fields: ["name", "source", "page", "lineage", "size", "speed", "entries"],
              within: { entries: { items: ["Fury of the Small"] } },
            },
            { id: "Boggart|LFL", fields: ["name", "source", "_copy", "lineage"] },
            {
              id: "Goblin|VGM",
              fields: ["name", "source", "page", "reprintedAs", "size", "speed", "entries"],
              within: {
                entries: {
                  items: [
                    {
                      id: "Darkvision",
                      set: {
                        entries: {
                          value: ["Goblins see in the dark."],
                          why: "replaceTxt needs prose carrying the word the copy replaces, and elided prose carries no words.",
                        },
                        data: {
                          value: { overwrite: "Goblins" },
                          why: "A structural key holding that same word. Upstream carries no `data` on this trait, and replaceTxt reaching one would rewrite a reference.",
                        },
                      },
                    },
                    "Fury of the Small",
                    {
                      why: "A table under a _copy, which upstream has nowhere in this file. replaceTxt has to be shown reaching a caption, a column label and a cell.",
                      value: {
                        type: "table",
                        caption: "Goblins by Type",
                        colLabels: ["Goblins", "Trait"],
                        colStyles: ["col-6", "col-6"],
                        rows: [["Goblins", "Nimble Escape"]],
                      },
                    },
                  ],
                },
              },
            },
            { id: "Goblin (Dankwood)|AWM", fields: ["name", "source", "page", "_copy"] },
            {
              id: "Aasimar|MPMM",
              within: {
                entries: { items: ["Celestial Revelation", "Healing Hands"] },
                _versions: {
                  items: ["Aasimar; Necrotic Shroud|MPMM", "Aasimar; Radiant Consumption|MPMM"],
                },
              },
            },
            {
              id: "Dragonborn|XPHB",
              within: {
                entries: { items: ["Draconic Ancestry", "Breath Weapon"] },
                _versions: {
                  items: [
                    {
                      id: 0,
                      within: {
                        _abstract: {
                          within: { _mod: { within: { entries: { items: [0, 1] } } } },
                        },
                        _implementations: { items: [0, 1] },
                      },
                    },
                  ],
                },
              },
            },
            {
              id: "Elf|XPHB",
              fields: [
                "name",
                "source",
                "page",
                "srd52",
                "basicRules2024",
                "edition",
                "creatureTypes",
                "size",
                "speed",
                "darkvision",
                "traitTags",
                "skillProficiencies",
                "soundClip",
                "additionalSpells",
                "sizeEntry",
                "entries",
                "hasFluff",
                "hasFluffImages",
              ],
              within: { entries: { items: ["Elven Lineage"] } },
            },
            {
              id: "Elf|LFL",
              within: {
                _copy: { fields: ["name", "source"] },
                _versions: {
                  items: [
                    {
                      id: "Elf; Lorwyn Lineage|LFL",
                      fields: ["name", "source", "_mod"],
                      within: {
                        _mod: { within: { entries: { fields: ["mode", "replace", "items"] } } },
                      },
                    },
                  ],
                },
              },
            },
            {
              id: "Human|PHB",
              fields: [
                "name",
                "source",
                "page",
                "size",
                "speed",
                "languageProficiencies",
                "entries",
              ],
            },
            {
              id: "Dragonborn|PHB",
              fields: [
                "name",
                "source",
                "page",
                "ability",
                "resist",
                "traitTags",
                "languageProficiencies",
                "size",
                "speed",
                "entries",
              ],
            },
            {
              id: "Half-Orc|PHB",
              fields: [
                "name",
                "source",
                "page",
                "ability",
                "traitTags",
                "languageProficiencies",
                "size",
                "speed",
                "entries",
              ],
              within: { entries: { items: ["Darkvision", "Languages"] } },
            },
            {
              id: "Dragonborn (Chromatic)|FTD",
              fields: [
                "name",
                "source",
                "page",
                "lineage",
                "resist",
                "size",
                "speed",
                "entries",
                "_versions",
              ],
              within: {
                entries: {
                  items: ["Chromatic Ancestry", "Breath Weapon", "Draconic Resistance"],
                },
                _versions: {
                  items: [
                    {
                      id: 0,
                      within: {
                        _abstract: {
                          within: { _mod: { within: { entries: { items: [0, 1, 2] } } } },
                        },
                        _implementations: { items: [0, 1] },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
        subrace: {
          items: [
            {
              id: "Variant|PHB|Human|PHB",
              fields: [
                "name",
                "source",
                "raceName",
                "raceSource",
                "page",
                "ability",
                "skillProficiencies",
                "entries",
              ],
              within: { entries: { items: ["Skills"] } },
            },
            {
              id: "PHB|Dragonborn|PHB",
              fields: ["source", "page", "raceName", "raceSource", "_versions"],
              within: {
                _versions: {
                  items: [
                    {
                      id: 0,
                      within: {
                        _abstract: {
                          within: { _mod: { within: { entries: { items: [0, 1, 2] } } } },
                        },
                        _implementations: { items: [0, 1] },
                      },
                    },
                  ],
                },
              },
            },
            {
              id: "Variant; Mark of Finding|ERLW|Half-Orc|PHB",
              fields: [
                "name",
                "source",
                "page",
                "raceName",
                "raceSource",
                "languageProficiencies",
                "entries",
              ],
              within: { entries: { items: ["Languages"] } },
            },
            {
              id: "Draconblood|EGW|Dragonborn|PHB",
              fields: [
                "name",
                "source",
                "page",
                "raceName",
                "raceSource",
                "ability",
                "darkvision",
                "overwrite",
                "resist",
                "entries",
                "_versions",
              ],
              within: {
                _versions: {
                  items: [
                    {
                      id: 0,
                      within: {
                        _abstract: {
                          within: { _mod: { within: { entries: { items: [0, 1] } } } },
                        },
                        _implementations: { items: [0] },
                      },
                    },
                  ],
                },
              },
            },
            {
              id: "Amonkhet|PSA",
              fields: ["name", "source", "page", "_copy"],
              within: {
                _copy: {
                  within: {
                    _mod: {
                      within: {
                        entries: {
                          items: [{ id: 0, within: { items: { items: ["Age", "Alignment"] } } }],
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  },
  {
    file: "data/senses.json",
    keep: { within: { sense: { items: ["Darkvision|PHB", "Darkvision|XPHB"] } } },
  },
  {
    file: "data/skills.json",
    keep: { within: { skill: { items: ["Acrobatics|PHB", "Acrobatics|XPHB"] } } },
  },
  {
    file: "data/spells/spells-phb.json",
    keep: {
      within: {
        spell: {
          items: [
            {
              id: "Acid Splash|PHB|0",
              fields: [...SPELL_FIELDS, "srd", "reprintedAs", "damageInflict", "savingThrow"],
            },
            { id: "Detect Magic|PHB|1", fields: [...SPELL_FIELDS, "srd", "reprintedAs", "meta"] },
          ],
        },
      },
    },
  },
  {
    file: "data/spells/spells-xphb.json",
    keep: {
      within: {
        spell: {
          items: [
            {
              id: "Acid Splash|XPHB|0",
              fields: [
                ...SPELL_FIELDS,
                "srd52",
                "entriesHigherLevel",
                "damageInflict",
                "savingThrow",
              ],
            },
            { id: "Detect Magic|XPHB|1", fields: [...SPELL_FIELDS, "srd52", "meta"] },
          ],
        },
      },
    },
  },
  {
    file: "data/tables.json",
    // A standalone table holds its prose in `rows`, where no field name says so.
    keep: { within: { table: { items: [{ id: "Damage Types|PHB", prose: ["rows"] }] } } },
  },
  {
    file: "data/variantrules.json",
    keep: { within: { variantrule: { items: ["Cover|XPHB", "Customizing Ability Scores|PHB"] } } },
  },
];
