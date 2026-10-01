import { describe, expect, it } from "vitest";
import { classesWorkspace, FIXTURE_VENDOR, table } from "../test/class-vendor.ts";
import { characterOptions } from "./character-options.ts";
import { classes } from "./classes.ts";

describe("the class optional feature progressions", () => {
  const { build, open, vendorHolding, refusal } = classesWorkspace();

  it("carries a sparse progression forward, and stores a stated one as it stands", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT level, feature_type, known FROM class_optional_features " +
          "WHERE class_name = 'Warlock' AND level <= 5 ORDER BY level, feature_type",
      )
      .all();
    db.close();

    // The invocations are 20 stated cells and the pact boon is {"3": 1}: level 4
    // is silent in the sparse form and still knows the boon it took at 3, while
    // levels 1 and 2 store nothing at all because neither grants one yet.
    expect(rows).toEqual([
      { level: 2, feature_type: "EI", known: 2 },
      { level: 3, feature_type: "EI", known: 2 },
      { level: 3, feature_type: "PB", known: 1 },
      { level: 4, feature_type: "EI", known: 2 },
      { level: 4, feature_type: "PB", known: 1 },
      { level: 5, feature_type: "EI", known: 3 },
      { level: 5, feature_type: "PB", known: 1 },
    ]);
  });

  it("files a subclass progression under the subclass that grants it", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const rows = db
      .prepare(
        "SELECT subclass_name, level, feature_type, known FROM subclass_optional_features " +
          "WHERE level IN (2, 3, 6, 7) ORDER BY level",
      )
      .all();
    const classSide = db
      .prepare("SELECT COUNT(*) FROM class_optional_features WHERE class_name = 'Fighter'")
      .pluck()
      .get();
    db.close();

    expect(rows).toEqual([
      { subclass_name: "Battle Master", level: 3, feature_type: "MV:B", known: 3 },
      { subclass_name: "Battle Master", level: 6, feature_type: "MV:B", known: 3 },
      { subclass_name: "Battle Master", level: 7, feature_type: "MV:B", known: 5 },
    ]);
    expect(classSide).toBe(0);
  });

  it("answers what a class may pick at a level, as one join over both halves", () => {
    build(FIXTURE_VENDOR, [classes, characterOptions]);

    const db = open();
    const query = db.prepare(
      "SELECT known.known, options.name, options.source FROM class_optional_features AS known " +
        "JOIN optional_feature_types AS types ON types.feature_type = known.feature_type " +
        "JOIN optional_features AS options ON options.name = types.name " +
        "AND options.source = types.source " +
        "WHERE known.class_name = ? AND known.class_source = ? AND known.level = ? " +
        "AND options.edition = ? ORDER BY options.name",
    );
    const atFive = query.all("Warlock", "PHB", 5, "classic");
    const atThree = query.all("Warlock", "PHB", 3, "classic");
    const atOne = query.all("Warlock", "PHB", 1, "classic");
    db.close();

    // Three invocations at level 5, chosen from the options carrying EI in this
    // warlock's own edition — the XPHB Agonizing Blast is a different row and a
    // 2014 warlock may not take it. The one pact boon at 3 is a second type the
    // same class counts, so the join answers per type rather than per class.
    // Level 1 is entitled to none, an absent row rather than a zero.
    expect(atFive).toEqual([
      { known: 3, name: "Agonizing Blast", source: "PHB" },
      { known: 1, name: "Pact of the Chain", source: "PHB" },
    ]);
    expect(atThree).toEqual([
      { known: 2, name: "Agonizing Blast", source: "PHB" },
      { known: 1, name: "Pact of the Chain", source: "PHB" },
    ]);
    expect(atOne).toEqual([]);
  });

  const progressing = (progression: unknown, featureType: unknown = ["MM"]) => ({
    class: [
      {
        name: "Sorcerer",
        source: "PHB",
        edition: "classic",
        hd: { number: 1, faces: 6 },
        optionalfeatureProgression: [{ name: "Metamagic", featureType, progression }],
      },
    ],
  });

  it.each([
    [
      "a progression of neither shape",
      4,
      /progression is neither a list of levels nor a map of them/,
    ],
    ["a progression short of 20 levels", [1, 2], /2 cells, and a progression covers all 20 levels/],
    ["a level past 20", { 21: 1 }, /"21" is not a level from 1 to 20/],
    ["a level of 0", { 0: 1 }, /"0" is not a level from 1 to 20/],
    ["a level that only coerces to one", { " 3": 1 }, /" 3" is not a level from 1 to 20/],
    ["a padded level", { "03": 1 }, /"03" is not a level from 1 to 20/],
    ["the wildcard five feats carry", { "*": 1 }, /keyed "\*" has no level/],
    ["a count that is not one", { 3: "two" }, /"two" is not a count of options/],
    ["a progression that entitles nothing", {}, /a progression no level may pick from/],
    [
      "a progression of 20 zeros, which is the same thing stated",
      Array.from({ length: 20 }, () => 0),
      /a progression no level may pick from/,
    ],
  ])("refuses %s", (_case, progression, reason) => {
    expect(refusal(vendorHolding("class-sorcerer.json", progressing(progression)))).toMatch(reason);
  });

  it("refuses two progressions of one entry that offer the same type", () => {
    const contents = {
      class: [
        {
          name: "Warlock",
          source: "PHB",
          edition: "classic",
          hd: { number: 1, faces: 8 },
          optionalfeatureProgression: [
            { name: "Eldritch Invocations", featureType: ["EI"], progression: { 2: 2 } },
            { name: "Pact Boon", featureType: ["EI"], progression: { 3: 1 } },
          ],
        },
      ],
    };

    expect(refusal(vendorHolding("class-warlock.json", contents))).toMatch(
      /two progressions offer EI at level 3, and one row holds one count/,
    );
  });

  const counting = (rows: unknown[][], progression: unknown) => ({
    class: [
      {
        name: "Warlock",
        source: "PHB",
        edition: "classic",
        hd: { number: 1, faces: 8 },
        classTableGroups: [
          { colLabels: ["{@filter Invocations Known|optionalfeatures|feature type=ei}"], rows },
        ],
        ...(progression === undefined
          ? {}
          : {
              optionalfeatureProgression: [
                { name: "Eldritch Invocations", featureType: ["EI"], progression },
              ],
            }),
      },
    ],
  });

  it("pairs the warlock's invocation column with its progression, per level", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const paired = db
      .prepare(
        "SELECT printed.level, printed.value, offered.known FROM class_resources AS printed " +
          "JOIN class_optional_features AS offered ON offered.class_name = printed.class_name " +
          "AND offered.class_source = printed.class_source AND offered.level = printed.level " +
          "WHERE printed.resource_key = 'invocations_known' AND offered.feature_type = 'EI' " +
          "ORDER BY printed.level",
      )
      .all() as { level: number; value: string; known: number }[];
    db.close();

    // The pairing is only as discoverable as the `feature type=ei` in the label,
    // and the plain wording is pinned in RESOURCE_KEYS, so a label rewritten as
    // prose would keep loading the resource row and pair nothing. This fails if
    // that happens to the fixture, the half of the exposure a test can
    // reach; upstream doing it to a real class cannot be caught without the map
    // reading the tag exists to avoid.
    expect(paired.length).toBe(19);
    expect(paired.every((row) => row.value === String(row.known))).toBe(true);
  });

  it("pairs the artificer's infusion column with its progression, per level", () => {
    build(FIXTURE_VENDOR);

    const db = open();
    const paired = db
      .prepare(
        "SELECT printed.level, printed.value, offered.known FROM class_resources AS printed " +
          "JOIN class_optional_features AS offered ON offered.class_name = printed.class_name " +
          "AND offered.class_source = printed.class_source AND offered.level = printed.level " +
          "WHERE printed.resource_key = 'infusions_known' AND offered.feature_type = 'AI' " +
          "ORDER BY printed.level",
      )
      .all() as { level: number; value: string; known: number }[];
    db.close();

    // The second counted column the corpus carries, and the one whose filter
    // trails `|source=TCE` after the code. Both columns are in the fixtures now,
    // so a label that stops carrying its filter fails here rather than pairing
    // nothing quietly.
    expect(paired.length).toBe(19);
    expect(paired.every((row) => row.value === String(row.known))).toBe(true);
  });

  it("refuses a counted column that disagrees with the progression restating it", () => {
    expect(refusal(vendorHolding("class-warlock.json", counting(table(2), { 1: 3 })))).toMatch(
      /level 1: the invocations_known column counts 2 and EI offers 3/,
    );
  });

  it("refuses a counted column the entry offers no progression for", () => {
    expect(refusal(vendorHolding("class-warlock.json", counting(table(2), undefined)))).toMatch(
      /a column counts EI, which no optionalfeatureProgression offers/,
    );
  });

  it.each([
    ["two codes a row could not divide", "ei;mm"],
    ["a negated code", "!ei"],
    ["a bracketed group", "[ei]"],
    ["a padded code", " ei"],
  ])("refuses %s in a feature-type filter", (_case, filter) => {
    const contents = {
      class: [
        {
          name: "Warlock",
          source: "PHB",
          edition: "classic",
          hd: { number: 1, faces: 8 },
          classTableGroups: [
            {
              colLabels: [`{@filter Invocations Known|optionalfeatures|feature type=${filter}}`],
              rows: table(2),
            },
          ],
          optionalfeatureProgression: [
            { name: "Eldritch Invocations", featureType: ["EI"], progression: { 1: 2 } },
          ],
        },
      ],
    };

    // Naming the form rather than the progression: the label is what this loader
    // cannot read, and blaming absent progression data would send a reader to
    // the wrong file.
    expect(refusal(vendorHolding("class-warlock.json", contents))).toMatch(
      /a column filters feature type "[^"]+", and this reads one plain code/,
    );
  });

  it("takes a counted column that agrees, tag and case difference and all", () => {
    // A sparse count carries forward to level 20, so the column has to as well.
    const held = Array.from({ length: 20 }, () => [2]);
    const vendorDir = vendorHolding("class-warlock.json", counting(held, { 1: 2 }));
    build(vendorDir);

    const db = open();
    const printed = db
      .prepare(
        "SELECT value FROM class_resources WHERE resource_key = 'invocations_known' AND level = 1",
      )
      .pluck()
      .get();
    const offered = db
      .prepare("SELECT known FROM class_optional_features WHERE feature_type = 'EI' AND level = 1")
      .pluck()
      .get();
    db.close();

    // The label says `feature type=ei` and the progression says `EI`, so the
    // pairing only holds if the check folds the case of the tag payload.
    expect([printed, offered]).toEqual(["2", 2]);
  });

  it("refuses one count offered under several types, which a row cannot divide", () => {
    expect(
      refusal(vendorHolding("class-sorcerer.json", progressing({ 3: 2 }, ["MM", "EI"]))),
    ).toMatch(/2 feature types share one count, and a row holds a count per type/);
  });

  it("refuses a progression naming no feature type, which no option could match", () => {
    expect(refusal(vendorHolding("class-sorcerer.json", progressing({ 3: 2 }, [])))).toMatch(
      /featureType is missing or empty/,
    );
  });

  it("refuses a class progression counting a type no optional feature carries", () => {
    // The pool is another loader's table, so this reads optionalfeatures.json
    // itself: a rename upstream would otherwise leave the count over an empty
    // join, two well formed halves and no query that reports it.
    expect(refusal(vendorHolding("class-sorcerer.json", progressing({ 3: 2 }, ["XI"])))).toMatch(
      /class\[0\]: Sorcerer\|PHB counts XI, which no optional feature of the classic edition carries/,
    );
  });

  it("refuses a count whose pool is all of the other edition", () => {
    const contents = {
      class: [
        {
          name: "Warlock",
          source: "XPHB",
          hd: { number: 1, faces: 8 },
          optionalfeatureProgression: [
            { name: "Pact Boon", featureType: ["PB"], progression: { 3: 1 } },
          ],
        },
      ],
    };

    // Pact of the Chain is PHB, and a sheet offers a character the options of
    // its own edition, so a 2024 warlock counting PB picks from nothing. The
    // pool is not empty — what makes this the quiet case.
    expect(refusal(vendorHolding("class-warlock.json", contents))).toMatch(
      /class\[0\]: Warlock\|XPHB counts PB, which no optional feature of the one edition carries/,
    );
  });

  it("refuses a subclass progression counting a type no optional feature carries", () => {
    const contents = {
      subclass: [
        {
          name: "Psi Warrior",
          shortName: "Psi Warrior",
          source: "XPHB",
          className: "Fighter",
          classSource: "XPHB",
          optionalfeatureProgression: [
            { name: "Psionic Powers", featureType: ["XI"], progression: { 3: 2 } },
          ],
        },
      ],
    };

    // Named by the entry that carries the progression, and by the file and
    // index too, since a subclass name and source repeat across classes.
    expect(refusal(vendorHolding("class-fighter.json", contents))).toMatch(
      /subclass\[0\]: Psi Warrior\|XPHB counts XI, which no optional feature of the one edition carries/,
    );
  });

  it("keeps a type the pool carries and no progression counts, as RP is", () => {
    build(FIXTURE_VENDOR, [classes, characterOptions]);

    const db = open();
    const offered = db
      .prepare("SELECT COUNT(*) FROM optional_feature_types WHERE feature_type = 'FS:B'")
      .pluck()
      .get();
    const counted = db
      .prepare("SELECT COUNT(*) FROM class_optional_features WHERE feature_type = 'FS:B'")
      .pluck()
      .get();
    db.close();

    // The invariant runs one way. Upstream ships four EFA options under RP,
    // Eberron house renown, which a story award grants rather than a class, so
    // an option no class counts has to load. FS:B is the fixture's own case.
    expect([offered, counted]).toEqual([1, 0]);
  });
});
