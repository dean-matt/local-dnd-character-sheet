import { type CharacterDefinition, type ContentRef, refKey } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { type SpellGrantorRef, useGrantedSpells } from "../../hooks/useGrantedSpells.ts";
import { subclassOf } from "./classLevels.ts";
import { CUSTOM_RACE_SOURCE } from "./useIdentityCatalog.ts";

/** A spell given outright, and the name of the row that gives it. */
export type GrantedSpell = { ref: ContentRef; by: string };

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
 * Every catalog row the draft names that can grant a spell, each at its level — the class
 * level for a class and subclass, the character level for the rest, which in a draft of one
 * class are the same number.
 */
function useGrantors(): SpellGrantorRef[] {
  const [levels = [], race, subrace, background, feats, optionalFeatures] = useWatch<
    CharacterDefinition,
    typeof WATCHED
  >({ name: WATCHED });
  const level = Math.max(1, levels.length);
  const cls = catalogRef(levels[0]?.class);
  const subclass = subclassOf(levels);
  const catalogRace = catalogRef(race);
  const catalogBackground = catalogRef(background);
  const at = (grantor: SpellGrantorRef["grantor"], ref: ContentRef, parent?: ContentRef) => ({
    grantor,
    ref,
    level,
    ...(parent && { parent }),
  });
  return [
    ...(cls ? [at("class", cls)] : []),
    ...(cls && subclass ? [at("subclass", subclass, cls)] : []),
    // A subrace's grants already hold its race's.
    ...(catalogRace
      ? [subrace ? at("subrace", subrace, catalogRace) : at("race", catalogRace)]
      : []),
    ...(catalogBackground ? [at("background", catalogBackground)] : []),
    ...catalogRefs(feats).map((ref) => at("feat", ref)),
    ...catalogRefs(optionalFeatures).map((ref) => at("optionalFeature", ref)),
  ];
}

/**
 * The spells the draft's rows give outright by their levels, each once under the first row
 * that gives it, or `undefined` while any row's list loads.
 */
export function useGrantedBy(): GrantedSpell[] | undefined {
  const grantors = useGrantors();
  const lists = useGrantedSpells(grantors);
  const seen = new Set<string>();
  return lists?.flatMap((spells, index) =>
    spells.flatMap((ref) => {
      if (seen.has(refKey(ref))) return [];
      seen.add(refKey(ref));
      return [{ ref, by: grantors[index]?.ref.name ?? "" }];
    }),
  );
}
