# 5etools data

What the upstream data actually looks like, and the parts that will surprise you.
Fetched by `pnpm content:sync` into `vendor/5etools/`, which is gitignored.

## Scale

The full `data/` tree is ~109 MB across ~503 JSON files. Most of it is not character
data: `adventure/` is 46 MB, `book/` 21 MB, `bestiary/` 17 MB. The character-relevant
subset is ~9.5 MB.

We fetch all of it anyway — one glob beats a curated list that silently rots — and
handle the difference at load time through the tier system in
[`architecture.md`](architecture.md).

## Identity and editions

**An entry is keyed `(name, source)`, never name alone.** Sources are book
abbreviations: `PHB`, `XPHB`, `XGE`, `TCE`, `EGW`, and so on.

Two rulesets ship side by side, marked with an `edition` field of `classic` (2014) or
`one` (2024). All 13 core classes exist in both. Spells split 361 `PHB` to 391 `XPHB`.

Every lookup table is doubled as a result — `skills.json` lists Acrobatics twice, once
per edition. Filtering by edition is not optional; without it every picker shows
duplicates.

`UATheMysticClass` is the only playtest source in character data — 66 entries, all of
them the Mystic class and its subclasses. Nothing else in the catalog is Unearthed
Arcana, and the Mystic has no official counterpart to collide with.

## `_copy` inheritance

Many entries are diffs against another entry rather than complete records. A `_copy`
block names the parent and a `_mod` block describes the changes. This must be resolved
during the ETL, never at query time.

It is concentrated, not universal:

```
class/          199    subclass feature inheritance — the heaviest
items.json       53
backgrounds.json 26
races.json       17
spells/           0    clean
feats.json        0
optionalfeatures  0
conditionsdiseases 0
actions.json      0
```

Spells being clean is why they are the right first target for the ETL.

`_meta.internalCopies` in each file names which keys need resolving, and
`packages/content/src/load/copy.ts` does it as part of reading a source, so loaders only
ever see complete records. Five `_mod` modes appear in character data — `appendArr`,
`prependArr`, `insertArr`, `replaceArr` and `replaceTxt`.

Everything the bestiary needs and character data does not is refused rather than
half-applied: cross-file parents, the `setProp` and `addSkills` modes, and the `*` and
`_` wildcard `_mod` properties. `internalCopies` is not trustworthy on its own either —
31 files carry a same-file `_copy` without declaring one — so a surviving `_copy` fails
the build too.

`_versions` is a **second, unrelated** inheritance mechanism and nothing resolves it yet.
An entry lists variants of itself, each with its own `_mod`, using modes `_copy` never
does — `removeArr`, `renameArr`, `addSpells`. It matters for characters: 48 entries in
`races.json` and 9 in `feats.json`. A loader over either sees them intact.

## Tag markup

Rules text is not plain prose. It is littered with `{@tag name|source|display}` markup:

```
"Deals {@damage 8d6} fire damage. {@dc 15} Dexterity save."
"See {@item chain mail|phb} and {@spell fireball}."
```

Twelve tags cover ~95% of about 15,000 occurrences in character-relevant files:

```
3815 {@spell        1428 {@damage       764 {@action
3130 {@variantrule  1172 {@skill        727 {@filter
2379 {@item          967 {@creature     452 {@i
1822 {@condition     847 {@dc           253 {@status
```

Two of those need care. `{@variantrule}` is the second most common tag because 2024
books link glossary terms constantly — `variantrules.json` must be imported or 3,130
links dangle. `{@filter}` points at a 5etools filtered list page, which means nothing
here, so it must degrade to its display text rather than erroring.

`generated/gendata-tag-redirects.json` is upstream's own map of renamed tags. Feed it to
the resolver so renames do not break links.

Do not vendor upstream's renderer. `js/render.js` is 18,009 lines; the ~12 tags above
are worth a small parser of our own. See the `tag-render` skill.

## Class resources

`classTableGroups` on a class entry is structured and indexed by level:

```
Barbarian  colLabels ["Rages", "Rage Damage"]   rows [["2", +2], ["2", +2], ["3", +2]]
Monk       colLabels ["Martial Arts", "Ki Points", "Unarmored Movement"]
Sorcerer   colLabels ["Sorcery Points"]
           rowsSpellProgression [[2,0,0,...], [3,0,...], [4,2,0,...]]
```

**Spell slots come free** via `rowsSpellProgression` — there is no need to hardcode the
slot table for any full or half caster.

Column labels are human strings, so the ETL needs a `colLabel -> resource key` map. The
vocabulary is small — 21 distinct labels across all classes, each appearing once or
twice (twice meaning both editions):

```
Rages · Rage Damage · Ki Points · Focus Points · Sorcery Points · Channel Divinity
Martial Arts · Bardic Die · Second Wind · Sneak Attack · Wild Shape · Weapon Mastery
Unarmored Movement · Infused Items · Favored Enemy · Psi Points · Psi Limit
Spell Slots · Slot Level · Plans Known · Magic Items
```

Three gaps the data cannot fill:

- **Only 6 of 322 subclasses have `subclassTableGroups`** — Eldritch Knight and Arcane
  Trickster spell progression, plus Psi Warrior dice. Battle Master superiority dice
  live in feature prose and are not extractable.
- **Warlock pact magic** uses separate `Spell Slots` and `Slot Level` columns instead of
  `rowsSpellProgression`.
- **Psi Warrior labels are `{@tip ...}` tags**, not plain strings.

Generic user-defined counters cover all three: a name, current and maximum values, and
a reset trigger. That one mechanism handles Battle Master dice and homebrew resources
without special-casing either.

## Useful generated files

`generated/gendata-subclass-lookup.json` saves deriving the class-to-subclass index.
`generated/gendata-tag-redirects.json` is described under tag markup above.
