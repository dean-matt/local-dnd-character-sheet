# Class tables

How upstream states what a class gets at each level, and what the ETL can and cannot
take from it. The tables themselves are in `packages/content/src/schema.ts` and the
loader is `packages/content/src/load/classes.ts`.

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

Column labels are human strings, so the ETL needs a `colLabel -> resource key` map. Of
the 130 distinct labels, 109 are `{@filter}` links to a 5etools spell or optional-feature
list and two are `{@tip}` tags; reduced to display text they collapse to 33. Twelve of
those arrive only as markup, and the remaining 21 are plain prose:

```
Rages · Rage Damage · Ki Points · Focus Points · Sorcery Points · Channel Divinity
Martial Arts · Bardic Die · Second Wind · Sneak Attack · Wild Shape · Weapon Mastery
Unarmored Movement · Infused Items · Favored Enemy · Psi Points · Psi Limit
Spell Slots · Slot Level · Plans Known · Magic Items
```

Four traps in reading a group:

- **Only 6 of 322 subclasses have `subclassTableGroups`** — Eldritch Knight and Arcane
  Trickster spell progression, plus Psi Warrior and Soulknife energy dice. Battle Master
  superiority dice live in feature prose and are not extractable. Each such group repeats
  its own subclass in a `subclasses` list, and all 10 name only their owner.
- **Warlock pact magic** uses separate `Spell Slots` and `Slot Level` columns instead of
  `rowsSpellProgression`. The slot level reads as `1st` in `PHB` and as `1` in `XPHB`.
- **Psi Warrior and Soulknife labels are `{@tip ...}` tags**, not plain strings.
- **A cell is not always a number**: `{"type": "bonus"}`, `{"type": "bonusSpeed"}` and
  `{"type": "dice"}` objects appear alongside counts, `{@dice D8}` markup, an em dash for
  a resource the level has not reached, and `Unlimited` for a level 20 barbarian's rages.

## Optional features per level

`optionalfeatureProgression` — 9 blocks over 8 class entries, the `PHB` warlock carrying
two, and 13 over 13 subclass entries — says how many options of a `featureType` a level
knows. It is the count half of the join whose pool half is a feature's own `featureType`
list. On a class or subclass it arrives in two shapes that mean different things at a
level they skip:

```
Warlock   progression [1,3,3,3,5,5,6,...]   20 cells, one per level
Sorcerer  progression {"3":2,"10":3,"17":4} the levels it changes at, and silent between
```

19 of the 22 blocks are the sparse object, which **carries its count forward**: a level 9
sorcerer knows the 2 kinds of metamagic it took at 3. Read as though it were dense, it
files a count at three levels and loses the other 15; a dense array read as sparse loses
every level. Both are normalized to a row per level.

`known` is the running total at that level, not the options gained there — a level 2
`XPHB` warlock knows 3 invocations, having gained 2. What a level adds is the difference
from the level below.

It is also a total per block, not per character: a class and its subclass can both offer
the same type, and a character gets the sum. A level 10 `PHB` Champion knows two fighting
styles — one from the Fighter row at level 1, one from the Champion row at level 10 — so a
query reading either table alone is short by the other.

Both tables store a row per level rather than one per plateau — 391 rows where 72 would
carry the same information. That redundancy buys an absent row that means *none*, the
same reading `class_resources` and `spell_slots` already have, and a primary key that
makes two counts at one level impossible. A `(from_level, to_level)` range would be
smaller and could not assert either: SQLite has no exclusion constraint, so an overlapping
or gapped range loads clean and answers wrong.

A third shape sits on entries with no level to hang a count on, and
`granted_optional_features` holds it. Four feats and one optional feature key a
progression `*`, for "at any level":

```
feats                Eldritch Adept|TCE      EI     1
feats                Fighting Initiate|TCE   FS:F   1
feats                Martial Adept|PHB       MV:B   2
feats                Metamagic Adept|TCE     MM     2
optional_features    Superior Technique|TCE  MV:B   1
```

All five are `classic`; no 2024 feat and no background or race carries one at the pinned
tag. `granted_by` names the table the grantor is in, because `Superior Technique` is a
fighting style that grants a maneuver in turn, so a grant row's identity is an optional
feature's as readily as a feat's. Nothing shares a `(name, source)` across the two files,
and without that column a query from a character's feats would answer with an option's
grant of the same name.

Each loader refuses the other's shape: a class or subclass progression keyed `*` has no
level to file a count at, and a leveless one keyed by a level would file a row that
ignores it. So the day upstream moves such a block between the two, the build says which
shape it found rather than storing a count nothing reads.

A character's total for a type is the three tables summed — the class row, the subclass
row, and a grant row for every feat and option they hold:

```sql
SELECT COALESCE(SUM(known), 0) FROM (
  SELECT known FROM class_optional_features
   WHERE class_name = ? AND class_source = ? AND level = ? AND feature_type = ?
  UNION ALL
  SELECT known FROM subclass_optional_features
   WHERE class_name = ? AND class_source = ? AND subclass_name = ? AND subclass_source = ?
     AND level = ? AND feature_type = ?
  UNION ALL
  SELECT known FROM granted_optional_features
   WHERE granted_by = ? AND name = ? AND source = ? AND feature_type = ?
);
```

A Battle Master 7 who took `Martial Adept` knows 7 maneuvers — 5 from the subclass row and
2 from the feat — out of the 43 options `optional_feature_types` carries for `MV:B`, 23 of
them `classic` and 20 `one`. The pool is unfiltered by edition there: a 2024 Battle Master
who took a 2014 feat picks from every maneuver the catalog holds, and what a table may
legally offer is a question for the picker.

Two upstream fields state the invocation and infusion counts, so two tables hold them:
`class_resources.invocations_known` and `infusions_known` come from a `colLabels` column,
and `class_optional_features.known` from `optionalfeatureProgression`. The build refuses
where they disagree, naming the level and both counts, so a newer tag that edits one field
and not the other fails the rebuild rather than shipping a sheet that prints a count the
picker does not offer. The typed row is the one to join, because it carries the
`featureType` that reaches the pool; the resource row is a number to print on a sheet.

The check pairs the two by reading the type code out of the column's own label —
`{@filter Invocations Known|optionalfeatures|feature type=ei}` names `ei` beside the text
the resource key comes from — rather than keeping a map from code to key, which would be
the kind of hand-kept list `edition.ts` warns goes stale the day upstream ships a book.
Three columns carry such a filter at the pinned tag. A column naming a type its entry
offers no progression for is refused, as is a filter value that is not one plain code —
the grammar also lists with `;`, negates with `!`, brackets groups and pads with spaces,
and 265 tags in the corpus use some of that somewhere. The refusal names the label rather
than the progression, because the label is the half this loader cannot read and blaming
absent progression data would send a reader to the wrong file.

The pairing is entry-local, which is its ceiling. All three pairs state the column and the
progression on the same class, but the two do split across entries elsewhere —
`Fighter|XPHB` carries no progression while `Battle Master|XPHB` carries `MV:B` — so a tag
that put a maneuver column on the fighter's own table would be refused rather than resolved
against the subclass. Collecting both across an entry and its subclasses before pairing is
the way out, and is not worth the pass until that happens.

What the check cannot see is a label that stops carrying the filter. The plain wordings are
pinned in `RESOURCE_KEYS`, so prose in place of the tag would keep loading the resource row
and pair nothing — the check going quiet rather than failing. Closing that needs the map
from type code to resource key this reads the tag to avoid, so it stays open, and refusing a
corpus that pairs nothing is not the way out: every loader test builds a small corpus that
legitimately has no counted column. A fixture test pins the warlock's pairing, which is the
half of the exposure a test can reach.

A count also has to reach a pool. `feature_type` names a code `optional_feature_types` is
expected to carry, and the two halves come from different loaders — `classes` and
`character-options` — so a SQL `REFERENCES` cannot hold it: a loader cannot read what an
earlier one wrote. The classes loader reads `optionalfeatures.json` for the codes itself,
the way every loader already reads `books.json` for an edition, and refuses a progression
naming one no feature carries. An upstream rename then fails the rebuild rather than
entitling a class to a count over an empty join — the row says a level 7 warlock picks 6,
the join returns nothing, and both rows are well formed.

The pool is keyed by edition as well as by code, because the pick is: a sheet offers the
options of the edition the counting row itself belongs to — the subclass's own where a
subclass counts, which is the same edition the query above filters on and not always its
class's. An entry counting a code only the other edition's features carry then has the
same empty join as one counting a code nothing carries. The corpus states 15 such pairs
and all of them resolve, the thinnest by 2 options.

That invariant is one-directional. A pool code no progression offers is legitimate: `RP`
is Eberron house renown, four `EFA` options a story award grants rather than a class, so
only the count side has to resolve.

The subclass table's key includes `subclass_source`, and a class offers both editions of a
subclass, so `Fighter|XPHB` holds `Battle Master|PHB` and `Battle Master|XPHB` — 5
maneuvers each at level 7. Fixing class, level and type returns two rows there. A query
filters `subclass_source`, or joins `subclasses` for the subclass's own edition, which is
the row's edition and never the class's.

One block carries more: Way of the Four Elements names a `required` discipline at level 3.
The count is what the table holds, so that stays in the entry's `json` — a character's
picks are not validated by the ETL.
