import type { SpellLookup } from "@dnd/catalog";
import {
  type CharacterDefinition,
  type ContentRef,
  displayName,
  type EntryRef,
  entryKey,
} from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { useSpellLookup } from "../../../hooks/useSpellLookup.ts";
import { setRefValue } from "../../../lib/setRefValue.ts";
import { spellsGained, subclassSpellsGained } from "./spellsGained.ts";
import type { useLevelUpClass } from "./useLevelUpClass.ts";

type Spell = CharacterDefinition["spells"][number];

const SPELLBOOK_SOURCES = ["PHB", "XPHB"];

/**
 * The cantrips and spells the level adds to what `cls` knows, and those its subclass's
 * features let the character choose, and the picks the draft's `spells` holds past
 * `definition`'s, split by the level each lookup found. A pick still loading is left out and
 * keeps `ready` false. A pick lands unprepared, as a known spell or a cantrip is, with the
 * class as its origin; a subclass pick holds the subclass there until `spellsUnderClass`
 * moves it at Apply, which is what tells the two apart. Each pick states the character level it
 * was `pickedAt`. A Wizard's spells go to its spellbook, which `spellbook`
 * reports. `saved`, for a reopened past level, is its subclass and the picks it holds stamped
 * as saved.
 */
export function useLevelUpSpells(
  definition: CharacterDefinition,
  cls: EntryRef,
  target: ReturnType<typeof useLevelUpClass>,
  spells: readonly Spell[],
  saved?: { subclass: ContentRef | undefined; picks: readonly Spell[] },
) {
  const { setValue } = useFormContext<CharacterDefinition>();
  const catalog = "name" in cls ? cls : undefined;
  const spellbook = catalog?.name === "Wizard" && SPELLBOOK_SOURCES.includes(catalog.source);
  const gained = spellsGained(
    [target.before, target.subclassBefore],
    [target.after, target.subclassAfter],
    spellbook,
  );
  const { subclass, subclassRow } = target;
  const offered =
    catalog && subclass && subclassRow
      ? subclassSpellsGained(
          subclassRow.json,
          target.subclassBefore !== undefined,
          target.level,
          target.next,
          { after: [target.after, target.subclassAfter], subclass: target.subclassAfter },
          spellbook,
        )
      : { cantrips: 0, spells: 0, either: 0 };
  const offer = catalog &&
    subclass && {
      grantor: "subclass" as const,
      ref: subclass,
      parent: catalog,
      level: target.next,
    };
  const bySubclass = (spell: Spell) =>
    subclass !== undefined &&
    spell.origin !== undefined &&
    entryKey(spell.origin) === entryKey(subclass);
  const list = catalog && {
    class: catalog,
    ...(target.subclass && { subclass: target.subclass }),
    level: target.next,
  };
  const known = new Set(definition.spells.map((spell) => entryKey(spell.ref)));
  const added = spells.filter((spell) => !known.has(entryKey(spell.ref)));
  const contextOf = (spell: Spell | undefined) => {
    if (spell && bySubclass(spell) && offer) return { offer };
    return list ? { list } : {};
  };
  const current = useSpellLookup(
    added.map((spell) => spell.ref),
    (index) => contextOf(added[index]),
  );
  const sameSubclass =
    saved !== undefined &&
    saved.subclass?.name === subclass?.name &&
    saved.subclass?.source === subclass?.source;
  const held = sameSubclass ? saved.picks : [];
  const prior = useSpellLookup(
    held.map((spell) => spell.ref),
    (index) => contextOf(held[index]),
  );
  const room = {
    cantrips: gained.cantrips,
    spells: gained.spells,
    subclassCantrips: offered.cantrips,
    subclassSpells: offered.spells,
    subclassEither: offered.either,
  };
  const now = splitPicks(added, current.looked, bySubclass, room);
  const was = splitPicks(held, prior.looked, bySubclass, room);
  // A reopened level whose pick the spell list swapped holds fewer stamped picks in that
  // bucket than its table owes, and the spell learned there fills the gap, so the bucket owes
  // only what the level held. A changed subclass owes its whole offer.
  const owes = (bucket: Exclude<keyof typeof room, "subclassEither">) =>
    sameSubclass ? Math.min(room[bucket], was[bucket].length) : room[bucket];
  const subclassEither = Math.min(room.subclassEither, owes("subclassSpells"));
  const { cantrips, subclassCantrips } = now;
  const leveled = now.spells;
  const subclassLeveled = now.subclassSpells;
  const failed = current.failed || prior.failed;
  const pickedAt = definition.levels.length + 1;
  const write = (next: Spell[]) => setRefValue(setValue, "spells", next, { shouldDirty: true });
  return {
    gained,
    spellbook,
    list,
    known,
    cantrips,
    spells: leveled,
    failed,
    offer,
    offered,
    subclassName: subclass?.name ?? "the subclass",
    subclassCantrips,
    subclassSpells: subclassLeveled,
    eitherFilled: now.eitherFilled,
    /** How many of each kind the level owes, short of `gained` and `offered` on a reopened level. */
    owed: {
      cantrips: owes("cantrips"),
      spells: owes("spells"),
      subclassCantrips: owes("subclassCantrips"),
      subclassSpells: owes("subclassSpells"),
      /** How many of `subclassSpells` a cantrip may fill instead. */
      subclassEither,
    },
    ready:
      now.read === added.length &&
      was.read === held.length &&
      cantrips.length === owes("cantrips") &&
      leveled.length === owes("spells") &&
      subclassCantrips.length === owes("subclassCantrips") &&
      subclassLeveled.length === owes("subclassSpells") &&
      now.eitherFilled <= subclassEither,
    add: (ref: EntryRef) =>
      write([...spells, { ref, prepared: false, ...(catalog && { origin: catalog }), pickedAt }]),
    addSubclass: (ref: EntryRef) =>
      write([...spells, { ref, prepared: false, ...(subclass && { origin: subclass }), pickedAt }]),
    remove: (ref: EntryRef) =>
      write(spells.filter((spell) => entryKey(spell.ref) !== entryKey(ref))),
  };
}

type Room = {
  cantrips: number;
  spells: number;
  subclassCantrips: number;
  subclassSpells: number;
  subclassEither: number;
};

/**
 * `spells` with their lookups, those still loading left out and counted apart from `read`,
 * split by kind and by whether each was picked under the class or its subclass. A past
 * level's subclass picks hold the class as their origin, since Apply moved them there, so
 * the class's picks past its room fill the subclass's, unlisted ones first. Where the
 * subclass has `subclassEither` picks, each subclass cantrip past its cantrip room fills a
 * spell pick, so one past `subclassEither` still shows where the player can remove it.
 * Where both lists hold a pick the split goes by order, so a class pick can land under a
 * narrower offer that lacks it; stamping a subclass pick with its offer at Apply is the way
 * out.
 */
function splitPicks(
  spells: readonly Spell[],
  looked: readonly (SpellLookup | undefined)[],
  bySubclass: (spell: Spell) => boolean,
  room: Room,
) {
  const read = spells.flatMap((spell, index) => {
    const { ref } = spell;
    const found = looked[index];
    if (found === undefined) return [];
    const { name, level, listed } = found ?? { name: displayName(ref), level: undefined };
    return [{ ref, name, level, listed, subclass: bySubclass(spell) }];
  });
  const surplus = (cantrip: boolean, own: number, owed: number) => {
    const kind = read.filter((pick) => (pick.level === 0) === cantrip);
    const mine = kind.filter((pick) => !pick.subclass);
    const count = Math.min(mine.length - own, owed - (kind.length - mine.length));
    const ordered = [
      ...mine.filter((pick) => pick.listed === false),
      ...mine.filter((pick) => pick.listed !== false),
    ];
    return ordered.slice(0, Math.max(0, count)).map((pick) => entryKey(pick.ref));
  };
  const movedCantrips = new Set(
    surplus(true, room.cantrips, room.subclassCantrips + room.subclassEither),
  );
  const underSubclass = (pick: (typeof read)[number]) =>
    pick.subclass || movedCantrips.has(entryKey(pick.ref));
  const subclassCantrips = read.filter((pick) => pick.level === 0 && underSubclass(pick));
  const filling = Math.min(
    room.subclassEither,
    Math.max(0, subclassCantrips.length - room.subclassCantrips),
  );
  const moved = new Set([
    ...movedCantrips,
    ...surplus(false, room.spells, room.subclassSpells - filling),
  ]);
  const picked = read.map((pick) => ({
    ...pick,
    subclass: pick.subclass || moved.has(entryKey(pick.ref)),
  }));
  const of = (subclass: boolean, cantrip: boolean) =>
    picked.filter((pick) => pick.subclass === subclass && (pick.level === 0) === cantrip);
  const cantripsKept = room.subclassEither > 0 ? room.subclassCantrips : Number.POSITIVE_INFINITY;
  const filled = of(true, true).slice(cantripsKept);
  return {
    read: read.length,
    cantrips: of(false, true),
    spells: of(false, false),
    subclassCantrips: of(true, true).slice(0, cantripsKept),
    subclassSpells: [...of(true, false), ...filled],
    /** How many subclass spell picks hold a cantrip, past `subclassEither` where too many do. */
    eitherFilled: filled.length,
  };
}
