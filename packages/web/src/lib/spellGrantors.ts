/**
 * The row a spell pick or a spell block choice is stored under, read from the row that
 * offers it.
 */
import { type CharacterDefinition, spellBlockKey } from "@dnd/character";
import type { SpellGrantorRef } from "../hooks/useGrantedSpells.ts";

/** The row a pick was made for, where a row other than the class offered it. */
export type PickGrantor = NonNullable<CharacterDefinition["spells"][number]["pickedFor"]>;

/** The row a choice of alternative spell block is stored under. */
export type BlockGrantor = CharacterDefinition["spellBlocks"][number]["grantor"];

/** What a pick made for `row` stores, or `undefined` for the class and subclass, whose picks name none. */
export function pickedForOf({ grantor, ref, parent }: SpellGrantorRef): PickGrantor | undefined {
  if (grantor === "class" || grantor === "subclass") return undefined;
  if (grantor === "subrace") return parent ? { kind: grantor, ref, race: parent } : undefined;
  return { kind: grantor, ref };
}

/** The row a block choice for `row` is stored under, or `undefined` for a class, which offers none. */
export function blockGrantorOf(row: SpellGrantorRef): BlockGrantor | undefined {
  if (row.grantor === "class") return undefined;
  if (row.grantor === "subclass") {
    return row.parent ? { kind: "subclass", ref: row.ref, class: row.parent } : undefined;
  }
  return pickedForOf(row);
}

type Blocks = CharacterDefinition["spellBlocks"];

/** `blocks` with `block` chosen for `grantor`, or `blocks` itself where it already is. */
export function withSpellBlock(blocks: Blocks, grantor: BlockGrantor, block: number): Blocks {
  const held = blocks.find((choice) => spellBlockKey(choice.grantor) === spellBlockKey(grantor));
  if (held?.block === block) return blocks;
  return [...blocks.filter((choice) => choice !== held), { grantor, block }];
}
