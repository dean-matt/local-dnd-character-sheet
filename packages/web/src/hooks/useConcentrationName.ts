import type { Concentration } from "@dnd/character";
import { useSpellLookup } from "./useSpellLookup.ts";

const noContext = () => ({});

/**
 * The name of the spell `held` concentrates on: a catalog reference's own, a homebrew one's as
 * looked up, or "a homebrew spell" until the lookup answers. Undefined where none is held.
 */
export function useConcentrationName(held: Concentration | null): string | undefined {
  const homebrew = held && "homebrewId" in held.spell ? [held.spell] : [];
  const lookup = useSpellLookup(homebrew, noContext);
  if (!held) return undefined;
  return ("name" in held.spell ? held.spell.name : lookup.looked[0]?.name) ?? "a homebrew spell";
}
