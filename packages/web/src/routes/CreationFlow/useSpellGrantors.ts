import { type CharacterDefinition, type ContentRef, entryKey } from "@dnd/character";
import { useWatch } from "react-hook-form";
import type { SpellGrantorRef } from "../../hooks/useGrantedSpells.ts";
import { subclassOf } from "./classLevels.ts";
import { CUSTOM_RACE_SOURCE } from "./useIdentityCatalog.ts";

const catalogRef = (ref: CharacterDefinition["race"] | undefined): ContentRef | undefined =>
  ref && "name" in ref && ref.source !== CUSTOM_RACE_SOURCE ? ref : undefined;

const catalogRefs = (entries: readonly { ref: CharacterDefinition["race"] }[] | undefined) =>
  (entries ?? []).flatMap(({ ref }) => {
    const found = catalogRef(ref);
    return found ? [found] : [];
  });

const WATCHED = [
  "levels",
  "race",
  "subrace",
  "background",
  "feats",
  "optionalFeatures",
] as const satisfies readonly (keyof CharacterDefinition)[];

/**
 * Every catalog row the draft names that can grant a spell, each at its level — the first
 * class's own level for it and its subclass, the character level for the rest. A later
 * class grants none here, since starting spells come from the first class alone.
 */
export function useSpellGrantors(): SpellGrantorRef[] {
  const [levels = [], race, subrace, background, feats, optionalFeatures] = useWatch<
    CharacterDefinition,
    typeof WATCHED
  >({ name: WATCHED });
  const level = Math.max(1, levels.length);
  const first = levels[0]?.class;
  const cls = catalogRef(first);
  const classLevel = levels.filter(
    (each) => first && entryKey(each.class) === entryKey(first),
  ).length;
  const subclass = first && subclassOf(levels, first);
  const catalogRace = catalogRef(race);
  const catalogBackground = catalogRef(background);
  const at = (
    grantor: SpellGrantorRef["grantor"],
    ref: ContentRef,
    parent?: ContentRef,
    atLevel = level,
  ) => ({
    grantor,
    ref,
    level: atLevel,
    ...(parent && { parent }),
  });
  return [
    ...(cls ? [at("class", cls, undefined, classLevel)] : []),
    ...(cls && subclass ? [at("subclass", subclass, cls, classLevel)] : []),
    // A subrace's grants already hold its race's.
    ...(catalogRace
      ? [subrace ? at("subrace", subrace, catalogRace) : at("race", catalogRace)]
      : []),
    ...(catalogBackground ? [at("background", catalogBackground)] : []),
    ...catalogRefs(feats).map((ref) => at("feat", ref)),
    ...catalogRefs(optionalFeatures).map((ref) => at("optionalFeature", ref)),
  ];
}
