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

Two rulesets ship side by side, `classic` (2014) and `one` (2024). All 13 core classes
exist in both. Spells split 361 `PHB` to 391 `XPHB`.

The `edition` field marking them is sparse — no spell carries one — so the source
decides, by the publish date its `books.json` or `adventures.json` entry carries:
2024-09-17, the 2024 Player's Handbook, onward is `one`. `load/edition.ts` does it. A
hand-kept list of 2024 abbreviations was wrong within a year and said so nowhere.

Every lookup table is doubled as a result — `skills.json` lists Acrobatics twice, once
per edition. Filtering by edition is not optional; without it every picker shows
duplicates.

Deities are the one exception to the two-part key: `{@deity Ioun|dawn war|dmg}` names a
pantheon because five `PHB` gods share a name with a god of another one — Oghma,
Silvanus, Surtur, Thrym and Tyr. `lookups.qualifier` holds it.

Three of the 30 class entries are Tasha's sidekicks, flagged `isSidekick`. None carries
`hd` or `proficiency`, because a sidekick's hit die comes from its creature stat block,
so the class loader skips all three rather than inventing three holes. Spellcaster
Sidekick does carry three `classTableGroups`, one of them a slot table written as plain
`rows` labelled `1st` to `5th` rather than as a `rowsSpellProgression` — loosening that
skip without handling it would file five spell slot columns as resources named after
ordinals, and nothing would fail.

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
the build too. A block two entries match is refused as well: identity is not always
`(name, source)`, and taking the first match would clone the wrong entry and say nothing.
No block in the corpus is ambiguous at the pinned tag — all six `_copy` deities name a
pantheon — so this fences the next upstream bump, not today's data.

## `_versions` inheritance

A **second, unrelated** mechanism: a copy merges two entries into one, a version expands
one into several. The base survives its versions — upstream offers the Dragonborn and
each of its ten colours — so `load/versions.ts` adds entries beside the one they were
written under, after `copy.ts` has run. Three race entries are both a copy and a source
of versions, and a `_mod` here edits text the copy supplied.

A version is written out with its own `name`, `source` and differing fields, or written
once as an `_abstract` template of `{{placeholder}}` text with an `_implementations` list
supplying the substitutions. All four placeholders in the corpus — `color`, `damageType`,
`area`, `savingThrow` — hold text. An implementation's other fields ride beside its
`_variables`, so a colour's `resist` is a field rather than a substitution.

Only four `_mod` modes appear across both files: `replaceArr`, `removeArr`, `prependArr`,
`appendArr`. `removeArr` is the one `_copy` never needed; neither `renameArr` nor
`addSpells` occurs in character data. A generated race identity is a plain
`(name, source)` and a subrace's is its four parts — across the 112 variants the two
files expand, none collides with anything.

A `_variables` member the template never mentions is a field written one level too deep,
where it is not text. A placeholder holds text, so such a member could never have been
substituted, and `Dragonborn (Chromatic)` in `FTD` states each colour's `resist` inside
`_variables` where the `PHB` and `EGW` dragonborn state the same key, in the same shape,
beside it. A member that *is* text and goes unused stays refused: that one could have
been substituted and was not, which is upstream saying something the ETL does not act on.

Three dragonborn subraces mod `Breath Weapon`, a trait upstream renders from the parent
race rather than storing on the subrace, so their 30 variants resolve only once the two
are one entry. That is why the subrace merge runs between `_copy` and `_versions`,
through the `prepare` hook on `Loader`, rather than in the races loader.

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

`generated/gendata-tag-redirects.json` is upstream's own map of renamed tags — 2,948 of
them. Feed it to the resolver so renames do not break links. It is grouped by the
namespace a link lands in, which is a page filename such as `variantrules.html` where the
type has a page and a bare tag name such as `skill` where it does not. A page is coarser
than a tag — `{@trap}` and `{@hazard}` share `trapshazards.html` — so the resolver maps
its tag to a namespace, never back. 36 redirects land in a different namespace than they
started in, and carry a `{ hash, page }` pair instead of a bare hash to say so.

Do not vendor upstream's renderer. `js/render.js` is 18,009 lines; the ~12 tags above
are worth a small parser of our own. See the `tag-render` skill.

`renderdemo.json` is upstream documenting its own tag grammar, with an example of each
of 87 tags written to describe itself — `{@bold some text to be bolded}`. It is the only
way to check that a tag's display argument is the right one, because reading the wrong
argument yields text that looks fine. Three tags rendered machine text as prose until
the registry was diffed against it.

## Items

Three files and four array keys land in the one `items` table, and the two decisions
they force — what to do with a magic variant and with an item group — have a document
of their own: [`items.md`](items.md).

## Class tables

`classTableGroups`, `subclassTableGroups` and `optionalfeatureProgression` state what a
class gets at each level, and have a document of their own:
[`class-tables.md`](class-tables.md).

## Useful generated files

`generated/gendata-subclass-lookup.json` saves deriving the class-to-subclass index.
`generated/gendata-tag-redirects.json` is described under tag markup above.
