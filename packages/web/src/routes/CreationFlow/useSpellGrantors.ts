import type { CharacterDefinition, ContentRef } from "@dnd/character";
import { useWatch } from "react-hook-form";
import type { SpellGrantorRef } from "../../hooks/useGrantedSpells.ts";
import { CUSTOM_RACE_SOURCE } from "../../lib/customRace.ts";
import { heldSpellGrantors, withChosenBlock } from "../../lib/spellGrantors.ts";
import { useClassEntries } from "./useClassEntries.ts";

const catalogRef = (ref: CharacterDefinition["race"] | undefined): ContentRef | undefined =>
  ref && "name" in ref && ref.source !== CUSTOM_RACE_SOURCE ? ref : undefined;

const WATCHED = [
  "levels",
  "race",
  "subrace",
  "background",
  "feats",
  "optionalFeatures",
  "spellBlocks",
] as const satisfies readonly (keyof CharacterDefinition)[];

/**
 * Every catalog row the draft names that can grant a spell, each at its level — the first
 * class's own level for it and its subclass, the character level for the rest. A later
 * class grants none here, since starting spells come from the first class alone.
 */
export function useSpellGrantors(): SpellGrantorRef[] {
  const [levels = [], race, subrace, background, feats, optionalFeatures, spellBlocks = []] =
    useWatch<CharacterDefinition, typeof WATCHED>({ name: WATCHED });
  const level = Math.max(1, levels.length);
  const first = useClassEntries().entries[0];
  const cls = first?.catalogClass;
  const classLevel = first?.level ?? level;
  const subclass = catalogRef(first?.subclass);
  const catalogRace = catalogRef(race);
  const catalogSubrace = catalogRef(subrace);
  const catalogBackground = catalogRef(background);
  const at = (
    grantor: SpellGrantorRef["grantor"],
    ref: ContentRef,
    parent?: ContentRef,
    atLevel = level,
  ): SpellGrantorRef =>
    withChosenBlock({ grantor, ref, level: atLevel, ...(parent && { parent }) }, spellBlocks);
  return [
    ...(cls ? [at("class", cls, undefined, classLevel)] : []),
    ...(cls && subclass ? [at("subclass", subclass, cls, classLevel)] : []),
    // A subrace's grants already hold its race's.
    ...(catalogRace
      ? [catalogSubrace ? at("subrace", catalogSubrace, catalogRace) : at("race", catalogRace)]
      : []),
    ...(catalogBackground ? [at("background", catalogBackground)] : []),
    ...heldSpellGrantors(
      { feats: feats ?? [], optionalFeatures: optionalFeatures ?? [], spellBlocks },
      level,
    ),
  ];
}
