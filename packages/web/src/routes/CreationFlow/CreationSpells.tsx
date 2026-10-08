import { type CharacterDefinition, entryKey } from "@dnd/character";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { withDeparture } from "./departures.ts";
import { SPELLS_FIELD } from "./spellPicks.ts";
import { useSpellChoices } from "./useSpellChoices.ts";

type SpellEntry = CharacterDefinition["spells"][number];

/**
 * Keeps the spells the draft's rows give outright, and the note on picks the rules would
 * refuse, in step with those rows on every step, so a subclass changed on Class swaps its
 * spells without a visit back to Spells. A pick a row now gives is dropped as a pick.
 */
export function CreationSpells() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const { ready, granted, note } = useSpellChoices();

  useEffect(() => {
    if (!granted) return;
    const held = getValues("spells") ?? [];
    const given = new Set(granted.map(({ ref }) => entryKey(ref)));
    const next: SpellEntry[] = [
      ...held.filter((entry) => !entry.granted && !given.has(entryKey(entry.ref))),
      ...granted.map(({ ref }) => ({ ref, prepared: true, granted: true as const })),
    ];
    if (JSON.stringify(next) !== JSON.stringify(held))
      setValue("spells", next, { shouldDirty: true });
  }, [granted, getValues, setValue]);

  useEffect(() => {
    if (!ready) return;
    const departures = getValues("departures");
    const next = withDeparture(departures, SPELLS_FIELD, note);
    if (JSON.stringify(next) !== JSON.stringify(departures ?? []))
      setValue("departures", next, { shouldDirty: true });
  }, [ready, note, getValues, setValue]);

  return null;
}
