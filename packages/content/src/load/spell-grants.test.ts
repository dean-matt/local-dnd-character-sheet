import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent, resolveContentDb } from "../build-db.ts";
import { spellGrants } from "./spell-grants.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

const spell = (name: string, level: number, extra: Record<string, unknown> = {}) => ({
  name,
  source: "PHB",
  level,
  school: "V",
  duration: [{ type: "instant" }],
  ...extra,
});

const SPELLS = [
  spell("Fire Bolt", 0, { spellAttack: ["R"] }),
  spell("Light", 0, { school: "V" }),
  spell("Guidance", 0, { school: "D" }),
  spell("Detect Magic", 1, { school: "D", meta: { ritual: true } }),
  spell("Shield", 1, { school: "A" }),
  spell("Misty Step", 2, { source: "XPHB", school: "C" }),
];

const WIZARD = { name: "Wizard", source: "PHB" };
const CLERIC = { name: "Cleric", source: "PHB" };

const SOURCES = {
  PHB: {
    "Fire Bolt": { class: [WIZARD] },
    Light: { class: [CLERIC], classVariant: [WIZARD] },
    Guidance: { class: [CLERIC] },
    "Detect Magic": { class: [CLERIC, WIZARD] },
    Shield: { class: [WIZARD] },
  },
};

type Grantors = {
  feat?: unknown[];
  optionalfeature?: unknown[];
  race?: unknown[];
  subrace?: unknown[];
  subclass?: unknown[];
};

const feat = (additionalSpells: unknown[]) => ({
  feat: [{ name: "Gift", source: "PHB", additionalSpells }],
});

describe("the spell grants loader", () => {
  let workspace: string;
  let contentDir: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-spell-grants-"));
    contentDir = join(workspace, "data", "content");
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  const build = (vendorDir: string) =>
    buildContent({ vendorDir, contentDir, loaders: [spellGrants], meta: {} });

  const vendorHolding = (grantors: Grantors): string => {
    const vendorDir = join(workspace, "vendor");
    const files: Record<string, unknown> = {
      "data/spells/spells-phb.json": { spell: SPELLS },
      "data/spells/sources.json": SOURCES,
      "data/class/class-test.json": {
        class: [WIZARD, CLERIC],
        subclass: grantors.subclass ?? [],
      },
      "data/feats.json": { feat: grantors.feat ?? [] },
      "data/optionalfeatures.json": { optionalfeature: grantors.optionalfeature ?? [] },
      "data/races.json": { race: grantors.race ?? [], subrace: grantors.subrace ?? [] },
    };
    for (const [file, content] of Object.entries(files)) {
      const destination = join(vendorDir, file);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, JSON.stringify(content));
    }
    return vendorDir;
  };

  const grants = (grantors: Grantors) => {
    build(vendorHolding(grantors));
    const db = new Database(resolveContentDb(contentDir), { readonly: true });
    const rows = db
      .prepare(
        "SELECT spell_name, spell_source, granted_by, name, source, parent_name, parent_source, chosen " +
          "FROM spell_grants ORDER BY granted_by, name, spell_name",
      )
      .all();
    db.close();
    return rows;
  };

  const offered = (grantors: Grantors) =>
    grants(grantors).map((row) => {
      const { spell_name, chosen } = row as { spell_name: string; chosen: number };
      return [spell_name, chosen];
    });

  const refusal = (grantors: Grantors): string => {
    try {
      build(vendorHolding(grantors));
    } catch (error) {
      const { cause } = error as Error;
      return cause instanceof Error ? cause.message : String(cause);
    }
    throw new Error("the build succeeded");
  };

  it("resolves a named spell by lowercase name, a default PHB source and no #c suffix", () => {
    expect(
      offered(feat([{ innate: { _: { daily: { "1": ["light#c", "misty step|xphb"] } } } }])),
    ).toEqual([
      ["Light", 0],
      ["Misty Step", 0],
    ]);
  });

  it("offers every spell a choose filter matches as a pick, class lists reading classVariant too", () => {
    expect(
      offered(feat([{ known: { _: [{ choose: "level=0|class=Wizard", count: 2 }] } }])),
    ).toEqual([
      ["Fire Bolt", 1],
      ["Light", 1],
    ]);
  });

  it("reads a clause's values as alternatives and its clauses as all required", () => {
    expect(offered(feat([{ known: { _: [{ choose: "level=0;1|school=D" }] } }]))).toEqual([
      ["Detect Magic", 1],
      ["Guidance", 1],
    ]);
  });

  it.each([
    ["school", "school=a", ["Shield"]],
    ["source", "source=XPHB", ["Misty Step"]],
    ["ritual", "components & miscellaneous=ritual", ["Detect Magic"]],
    ["spell attack", "spell attack=m;r;o", ["Fire Bolt"]],
    ["mixed-case class", "level=1|class=cleric", ["Detect Magic"]],
  ])("filters on %s", (_, filter, names) => {
    expect(offered(feat([{ known: { _: [{ choose: filter }] } }])).map(([name]) => name)).toEqual(
      names,
    );
  });

  it("gives an all filter outright, unless it only expands a class list", () => {
    expect(offered(feat([{ prepared: { "3": [{ all: "level=1|class=Wizard" }] } }]))).toEqual([
      ["Detect Magic", 0],
      ["Shield", 0],
    ]);
    expect(offered(feat([{ expanded: { "3": [{ all: "level=1|class=Wizard" }] } }]))).toEqual([
      ["Detect Magic", 1],
      ["Shield", 1],
    ]);
  });

  it("makes every spell a pick where a grantor offers blocks as alternatives", () => {
    expect(offered(feat([{ innate: { _: ["light"] } }, { innate: { _: ["shield"] } }]))).toEqual([
      ["Light", 1],
      ["Shield", 1],
    ]);
  });

  it("offers each spell a choose lists by name as a pick", () => {
    expect(
      offered(
        feat([{ innate: { _: { daily: { "1": [{ choose: { from: ["shield"], count: 1 } }] } } } }]),
      ),
    ).toEqual([["Shield", 1]]);
  });

  it("keeps a spell outright where one grant gives it and another offers it", () => {
    expect(
      offered(
        feat([
          { prepared: { "1": ["shield"] }, known: { _: [{ choose: "level=1|class=Wizard" }] } },
        ]),
      ),
    ).toEqual([
      ["Detect Magic", 1],
      ["Shield", 0],
    ]);
  });

  it("names a subclass's class and a subrace's race beside it, and gives a subrace its race's spells", () => {
    const rows = grants({
      subclass: [
        {
          name: "Eldritch Knight",
          shortName: "Eldritch Knight",
          source: "PHB",
          className: "Wizard",
          classSource: "PHB",
          additionalSpells: [{ prepared: { "3": ["shield"] } }],
        },
      ],
      race: [{ name: "Elf", source: "PHB", additionalSpells: [{ known: { "1": ["light"] } }] }],
      subrace: [{ name: "High", source: "PHB", raceName: "Elf", raceSource: "PHB" }],
      optionalfeature: [
        {
          name: "Eldritch Sight",
          source: "PHB",
          additionalSpells: [{ innate: { _: ["detect magic"] } }],
        },
      ],
    });

    expect(rows).toEqual([
      {
        spell_name: "Detect Magic",
        spell_source: "PHB",
        granted_by: "optional_features",
        name: "Eldritch Sight",
        source: "PHB",
        parent_name: "",
        parent_source: "",
        chosen: 0,
      },
      {
        spell_name: "Light",
        spell_source: "PHB",
        granted_by: "races",
        name: "Elf",
        source: "PHB",
        parent_name: "",
        parent_source: "",
        chosen: 0,
      },
      {
        spell_name: "Shield",
        spell_source: "PHB",
        granted_by: "subclasses",
        name: "Eldritch Knight",
        source: "PHB",
        parent_name: "Wizard",
        parent_source: "PHB",
        chosen: 0,
      },
      {
        spell_name: "Light",
        spell_source: "PHB",
        granted_by: "subraces",
        name: "High",
        source: "PHB",
        parent_name: "Elf",
        parent_source: "PHB",
        chosen: 0,
      },
    ]);
  });

  it("reads a null additionalSpells as none, the way a version un-sets its race's", () => {
    expect(grants({ feat: [{ name: "Gift", source: "PHB", additionalSpells: null }] })).toEqual([]);
  });

  it.each([
    [
      "names a spell no row holds",
      [{ innate: { _: ["wish"] } }],
      /names spell wish, which no row holds/,
    ],
    [
      "filters on a key no rule reads",
      [{ known: { _: [{ choose: "range=self" }] } }],
      /has no rule for range=self/,
    ],
    [
      "filters on a component other than ritual",
      [{ known: { _: [{ choose: "components & miscellaneous=concentration" }] } }],
      /only ritual is read/,
    ],
    [
      "filters on a spell level that is not one",
      [{ known: { _: [{ choose: "level=x" }] } }],
      /spell level x is not 0 to 9/,
    ],
  ])("fails the build on a grant that %s", (_, additionalSpells, reason) => {
    expect(refusal(feat(additionalSpells))).toMatch(reason);
  });

  it("resolves the fixtures' grants against their spells", () => {
    build(FIXTURE_VENDOR);
    const db = new Database(resolveContentDb(contentDir), { readonly: true });
    const deathDomain = db
      .prepare(
        "SELECT spell_name, chosen FROM spell_grants WHERE granted_by = 'subclasses' " +
          "AND name = 'Death Domain' AND parent_source = 'PHB' AND spell_name IN ('False Life', 'Light')",
      )
      .all();
    db.close();

    expect(deathDomain).toEqual([{ spell_name: "False Life", chosen: 0 }]);
  });
});
