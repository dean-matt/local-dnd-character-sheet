import type { CharacterRecord, ClassFeatureGrantor, EntryRef } from "@dnd/character";
import { entryKey } from "@dnd/character";
import { characterSpellsKey } from "../../../hooks/characterKeys.ts";
import { useCharacterSpells } from "../../../hooks/useCharacterSpells.ts";
import { useGrantedSpells } from "../../../hooks/useGrantedSpells.ts";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { useHomebrewEffects } from "../../../hooks/useHomebrewEffects.ts";
import { useRowWrites } from "../../../hooks/useRowWrites.ts";
import { featurePickRows, owesPick } from "../../../lib/featureSpellPicks.ts";
import {
  type BlockGrantor,
  heldSpellGrantors,
  type PickGrantor,
  withSpellBlock,
} from "../../../lib/spellGrantors.ts";
import {
  cantripsOf,
  type Offer,
  type PickedSpell,
  pickKey,
  rowPicks,
  spellsOf,
} from "../../../lib/spellPicks.ts";

const sameGrantor = (a: PickGrantor | undefined, b: PickGrantor) =>
  !!a && pickKey(a) === pickKey(b);

/**
 * The spells the feats, optional features and class features the character holds leave to a
 * pick, and which of them it has not made: each row owing a pick, and each row whose
 * alternative block, such as Magic Initiate's class, is still to choose. A row holding every
 * pick it owes appears in none. A class feature that picks from the spellbook, as Spell
 * Mastery does, marks a spell already known rather than adding one. The writes land in the
 * definition, so each enters the undo log.
 */
export function useOwedSpellPicks(character: CharacterRecord) {
  const { definition } = character;
  const spells = useCharacterSpells(character.id);
  const homebrewEffects = useHomebrewEffects();
  const grantors = heldSpellGrantors(definition, Math.max(1, definition.levels.length));
  const { lists, failed } = useGrantedSpells(grantors);
  const write = useHeldSave(character.id, "Spells");
  const { hold } = useRowWrites(characterSpellsKey(character.id));

  const offers: Offer[] = (lists ?? []).flatMap(({ picks, blocks }, index) => {
    const row = grantors[index];
    return row ? [{ row, blocks, picks }] : [];
  });
  // The projection lists the definition's spells in order, which is where a pick's level is read.
  const picked: PickedSpell[] = definition.spells.flatMap(({ ref, pickedFor, prepared }, index) => {
    const found = spells.data?.spells[index];
    if (!pickedFor || !found) return [];
    return [
      {
        ref,
        name: found.name,
        prepared,
        pickedFor,
        ...(found.resolved && { level: found.level }),
      },
    ];
  });
  const rows = rowPicks(offers, picked).filter(
    (row) =>
      cantripsOf(row.picked).length < row.owed.cantrips ||
      spellsOf(row.picked).length < row.owed.spells,
  );
  const featureRows = featurePickRows({ ...definition, homebrewEffects }, picked).filter(owesPick);
  const owing = new Set(rows.map(({ row }) => `${row.grantor}|${entryKey(row.ref)}`));
  const choosing = offers.filter(
    ({ row, blocks }) =>
      blocks.length > 0 &&
      (row.block === undefined || owing.has(`${row.grantor}|${entryKey(row.ref)}`)),
  );
  const held = new Set(definition.spells.map(({ ref }) => entryKey(ref)));
  // What a pick from the spellbook may name: a spell the character knows that no row claims.
  const book = new Set(
    definition.spells.flatMap((entry) =>
      entry.pickedFor || entry.granted ? [] : [entryKey(entry.ref)],
    ),
  );
  const edit = (
    key: string,
    change: (latest: CharacterRecord["definition"]) => CharacterRecord["definition"],
  ) => hold(() => write(key, change));

  return {
    rows,
    featureRows,
    choosing,
    held,
    book,
    ready: lists !== undefined && spells.data !== undefined,
    failed: failed || spells.isError,
    chooseBlock: (grantor: BlockGrantor, block: number) =>
      edit(`block:${JSON.stringify(grantor)}`, (latest) => ({
        ...latest,
        spellBlocks: withSpellBlock(latest.spellBlocks, grantor, block),
      })),
    add: (ref: EntryRef, pickedFor: PickGrantor) =>
      edit(`pick:${JSON.stringify([ref, pickedFor])}`, (latest) => ({
        ...latest,
        // A row's spell is always ready, so it lands prepared whatever the class does.
        spells: latest.spells.some((entry) => entryKey(entry.ref) === entryKey(ref))
          ? latest.spells
          : [...latest.spells, { ref, prepared: true, pickedFor }],
      })),
    pickForFeature: (ref: EntryRef, pickedFor: ClassFeatureGrantor, fromBook: boolean) =>
      edit(`pick:${JSON.stringify([ref, pickedFor])}`, (latest) => {
        const known = latest.spells.some((entry) => entryKey(entry.ref) === entryKey(ref));
        if (!fromBook) {
          return {
            ...latest,
            spells: known
              ? latest.spells
              : [...latest.spells, { ref, prepared: true, origin: pickedFor.class, pickedFor }],
          };
        }
        return {
          ...latest,
          spells: latest.spells.map((entry) =>
            entryKey(entry.ref) === entryKey(ref) && !entry.pickedFor && !entry.granted
              ? { ...entry, pickedFor }
              : entry,
          ),
        };
      }),
    unpickForFeature: (ref: EntryRef, pickedFor: ClassFeatureGrantor, fromBook: boolean) =>
      edit(`drop:${JSON.stringify([ref, pickedFor])}`, (latest) => ({
        ...latest,
        spells: fromBook
          ? latest.spells.map(({ pickedFor: by, ...entry }) =>
              entryKey(entry.ref) === entryKey(ref) && sameGrantor(by, pickedFor)
                ? entry
                : { ...entry, ...(by && { pickedFor: by }) },
            )
          : latest.spells.filter(
              (entry) =>
                !(entryKey(entry.ref) === entryKey(ref) && sameGrantor(entry.pickedFor, pickedFor)),
            ),
      })),
    remove: (ref: EntryRef, pickedFor: PickGrantor) =>
      edit(`drop:${JSON.stringify([ref, pickedFor])}`, (latest) => ({
        ...latest,
        spells: latest.spells.filter(
          (entry) =>
            !(entryKey(entry.ref) === entryKey(ref) && sameGrantor(entry.pickedFor, pickedFor)),
        ),
      })),
  };
}
