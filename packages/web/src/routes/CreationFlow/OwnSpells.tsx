import type { EntryRef } from "@dnd/character";
import { PickField, type PickFieldProps } from "../../components/PickField.tsx";
import type { CasterFacts } from "../../lib/casterFacts.ts";
import { PreparedField } from "./PreparedField.tsx";
import type { PickedSpell } from "./spellPicks.ts";

export interface OwnSpellsProps {
  field: Pick<PickFieldProps, "edition" | "unavailableReason" | "onRemove">;
  facts: CasterFacts | undefined;
  /** How many the class knows or prepares, `undefined` where nothing states a number. */
  count: number | undefined;
  spells: readonly PickedSpell[];
  filters: Record<string, string>;
  add: (ref: EntryRef, prepared: boolean) => void;
  toggle: (ref: EntryRef) => void;
}

/**
 * The class's own spells: those it knows or prepares, picked as `count` allows, or where it
 * keeps a spellbook, the book's spells and the `count` of them prepared.
 */
export function OwnSpells({ field, facts, count, spells, filters, add, toggle }: OwnSpellsProps) {
  const spellbook = facts?.spellbook;
  const prepares = facts?.prepares ?? false;
  const pick = { ...field, noun: "spell", picked: spells, filters };
  if (spellbook === undefined) {
    return (
      <PickField
        {...pick}
        heading={prepares ? "Spells Prepared" : "Spells Known"}
        count={count}
        onPick={(ref) => add(ref, prepares)}
      />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <PickField
        {...pick}
        heading="Spellbook"
        count={spellbook}
        onPick={(ref) => add(ref, false)}
      />
      <PreparedField count={count} spellbook={spells} onToggle={toggle} />
    </div>
  );
}
