import { type CharacterDefinition, spellBlockKey } from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { ChoicePills } from "./ChoicePills.tsx";
import { blockGrantorOf, type Offer } from "./spellPicks.ts";

/**
 * One choice for each row whose spells come as alternative blocks, such as the 2024 elf's
 * lineage: which block applies. The row's spells and picks follow the choice, and until it
 * is made the row's counts are the largest block's.
 */
export function SpellBlockChoices({ offers }: { offers: readonly Offer[] }) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const choose = (grantor: NonNullable<ReturnType<typeof blockGrantorOf>>, block: number) =>
    setValue(
      "spellBlocks",
      [
        ...(getValues("spellBlocks") ?? []).filter(
          (choice) => spellBlockKey(choice.grantor) !== spellBlockKey(grantor),
        ),
        { grantor, block },
      ],
      { shouldDirty: true },
    );
  return offers.map(({ row, blocks }) => {
    const grantor = blockGrantorOf(row);
    if (!grantor || blocks.length === 0) return null;
    return (
      <ChoicePills
        key={spellBlockKey(grantor)}
        legend={`${row.ref.name}: which spells apply`}
        prompting={row.block === undefined}
        options={blocks.map((label, index) => ({ value: String(index), label }))}
        value={row.block === undefined ? undefined : String(row.block)}
        onChange={(value) => choose(grantor, Number(value))}
      />
    );
  });
}
