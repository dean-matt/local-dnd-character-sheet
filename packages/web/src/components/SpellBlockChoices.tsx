import { spellBlockKey } from "@dnd/character";
import type { SpellGrantorRef } from "../hooks/useGrantedSpells.ts";
import { type BlockGrantor, blockGrantorOf } from "../lib/spellGrantors.ts";
import { ChoicePills } from "./ChoicePills.tsx";

export interface SpellBlockChoicesProps {
  /** Each row and the labels of the alternative blocks it offers, none where it offers one. */
  offers: readonly { row: SpellGrantorRef; blocks: readonly string[] }[];
  onChoose: (grantor: BlockGrantor, block: number) => void;
}

/**
 * One choice for each row whose spells come as alternative blocks, such as the 2024 elf's
 * lineage: which block applies. The row's spells and picks follow the choice, and until it
 * is made the row's counts are the largest block's.
 */
export function SpellBlockChoices({ offers, onChoose }: SpellBlockChoicesProps) {
  const seen = new Set<string>();
  return offers.map(({ row, blocks }) => {
    const grantor = blockGrantorOf(row);
    if (!grantor || blocks.length === 0 || seen.has(spellBlockKey(grantor))) return null;
    seen.add(spellBlockKey(grantor));
    return (
      <ChoicePills
        key={spellBlockKey(grantor)}
        legend={`${row.ref.name}: which spells apply`}
        prompting={row.block === undefined}
        options={blocks.map((label, index) => ({ value: String(index), label }))}
        value={row.block === undefined ? undefined : String(row.block)}
        onChange={(value) => onChoose(grantor, Number(value))}
      />
    );
  });
}
