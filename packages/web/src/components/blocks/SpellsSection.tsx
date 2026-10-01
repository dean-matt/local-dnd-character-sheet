/**
 * The Spells page: the numbers a caster reads before every cast, the slots each level
 * carries, then the spells themselves in one card, grouped by level. Every number comes
 * off the derived block and every spell off `/characters/{id}/spells`, so the page
 * does no rules arithmetic of its own.
 */
import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { EmptyState } from "../../EmptyState.tsx";
import { CasterNumbers } from "./CasterNumbers.tsx";
import { SpellList } from "./SpellList.tsx";
import { SpellSlots } from "./SpellSlots.tsx";

export function SpellsSection({
  character,
  derived,
}: {
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  if (!character || !derived) return <EmptyState>Spells isn't available yet.</EmptyState>;
  const casts =
    derived.spellcasting.length > 0 ||
    derived.spellSlots.length > 0 ||
    derived.pactSlots !== null ||
    character.definition.spells.length > 0;
  if (!casts) return <EmptyState>{character.name} doesn't cast spells.</EmptyState>;

  return (
    <div className="flex flex-col gap-4">
      <CasterNumbers derived={derived} />
      <SpellSlots derived={derived} />
      <SpellList character={character} />
    </div>
  );
}
