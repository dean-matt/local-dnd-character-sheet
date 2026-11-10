/**
 * The Spells page: the numbers a caster reads before every cast, the slots each level
 * carries, then the spells themselves in one card, grouped by level. Every number comes
 * off the derived block and every spell off `/characters/{id}/spells`, so the page
 * does no rules arithmetic of its own. A character with no spellcasting of its own still
 * casts what its subclass or its equipped items grant.
 */
import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { EmptyState } from "../../../EmptyState.tsx";
import { ErrorState } from "../../../ErrorState.tsx";
import { useCharacterSpells } from "../../../hooks/useCharacterSpells.ts";
import { LoadingState } from "../../../LoadingState.tsx";
import { CastingBlockedNote } from "../CastingBlockedNote.tsx";
import { CasterNumbers } from "./CasterNumbers.tsx";
import { RagingNote } from "./RagingNote.tsx";
import { SpellList } from "./SpellList/SpellList.tsx";
import { SpellSlots } from "./SpellSlots/SpellSlots.tsx";

export function SpellsSection({
  character,
  derived,
}: {
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  const spells = useCharacterSpells(character?.id ?? "");
  if (!character || !derived) return <EmptyState>Spells isn't available yet.</EmptyState>;
  const casts =
    derived.spellcasting.length > 0 ||
    derived.spellSlots.length > 0 ||
    derived.pactSlots !== null ||
    character.definition.spells.length > 0;
  if (!casts) {
    if (spells.isPending) return <LoadingState label="Loading spells…" />;
    if (spells.isError) return <ErrorState error={spells.error} />;
    if (spells.data.spells.length === 0) {
      return <EmptyState>{character.name} doesn't cast spells.</EmptyState>;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <CastingBlockedNote armor={derived.castingBlockedBy} />
      <RagingNote id={character.id} />
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <CasterNumbers character={character} derived={derived} />
        <SpellSlots character={character} derived={derived} />
      </div>
      <SpellList character={character} derived={derived} />
    </div>
  );
}
