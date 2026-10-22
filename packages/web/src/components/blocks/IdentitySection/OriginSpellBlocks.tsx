import { type CharacterDefinition, spellBlockKey } from "@dnd/character";
import { type SpellGrantorRef, useGrantedSpells } from "../../../hooks/useGrantedSpells.ts";
import type { DefinitionEdit } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { type BlockGrantor, blockGrantorOf, withSpellBlock } from "../../../lib/spellGrantors.ts";
import { SpellBlockChoices } from "../../SpellBlockChoices.tsx";

export interface OriginSpellBlocksProps {
  definition: CharacterDefinition;
  /** The race, subrace or background row the character holds, absent where none is a catalog row. */
  row: Omit<SpellGrantorRef, "level" | "block"> | undefined;
  /** The grantor kinds `row` stands for, whose choices for any other row are kept from before. */
  kinds: readonly BlockGrantor["kind"][];
  write: (key: string, edit: DefinitionEdit) => void;
}

/**
 * Which of the row's alternative spell blocks applies, where it offers more than one, read
 * at the character's level. A choice stored for a row of the same kind the character no
 * longer holds applies nothing, so it is named with a way to remove it.
 */
export function OriginSpellBlocks({ definition, row, kinds, write }: OriginSpellBlocksProps) {
  const level = Math.max(1, definition.levels.length);
  const key = row && blockGrantorOf({ ...row, level });
  const held =
    key &&
    definition.spellBlocks.find((choice) => spellBlockKey(choice.grantor) === spellBlockKey(key));
  const grantors = row ? [{ ...row, level, ...(held && { block: held.block }) }] : [];
  const { lists } = useGrantedSpells(grantors);
  const kept = definition.spellBlocks.filter(
    (choice) =>
      kinds.includes(choice.grantor.kind) &&
      (key === undefined || spellBlockKey(choice.grantor) !== spellBlockKey(key)),
  );
  const keptKeys = new Set(kept.map((choice) => spellBlockKey(choice.grantor)));

  return (
    <>
      <SpellBlockChoices
        offers={grantors.map((each, index) => ({
          row: each,
          blocks: lists?.[index]?.blocks ?? [],
        }))}
        onChoose={(grantor, block) =>
          write("spellBlocks", (latest) => ({
            ...latest,
            spellBlocks: withSpellBlock(latest.spellBlocks, grantor, block),
          }))
        }
      />
      {kept.length > 0 && (
        <div role="status" className="mt-2 flex flex-col items-start gap-1 text-row">
          <p className="text-secondary">
            {kept.length === 1
              ? `The spell choice for ${kept[0]?.grantor.ref.name} is kept from before and applies nothing.`
              : `The spell choices for ${kept.map((choice) => choice.grantor.ref.name).join(", ")} are kept from before and apply nothing.`}
          </p>
          <button
            type="button"
            onClick={() =>
              write("spellBlocks", (latest) => ({
                ...latest,
                spellBlocks: latest.spellBlocks.filter(
                  (choice) => !keptKeys.has(spellBlockKey(choice.grantor)),
                ),
              }))
            }
            className="text-muted underline"
          >
            {kept.length === 1 ? "Remove it" : "Remove them"}
          </button>
        </div>
      )}
    </>
  );
}
