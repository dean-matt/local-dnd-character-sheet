/**
 * The initiative, hit point and speed bonuses a feat states only in its prose. 5etools
 * carries no field for them, so the sheet knows each feat by `(name, source)`, and a feat
 * this table does not name adds nothing.
 */
import type { Term } from "@dnd/rules";
import type { Speed } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { refKey } from "./keys.ts";
import type { ContentRef } from "./refs.ts";

type FeatBonus = {
  initiative?: number | "proficiency";
  hitPointsPerLevel?: number;
  walk?: number;
};

const FEAT_BONUSES = new Map<string, FeatBonus>([
  ["Alert|PHB", { initiative: 5 }],
  ["Alert|XPHB", { initiative: "proficiency" }],
  ["Tough|PHB", { hitPointsPerLevel: 2 }],
  ["Tough|XPHB", { hitPointsPerLevel: 2 }],
  ["Mobile|PHB", { walk: 10 }],
  ["Speedy|XPHB", { walk: 10 }],
]);

type Feats = Pick<CharacterDefinition, "feats">;

/** Each catalog feat the table names, once: none of them can be taken twice. */
function bonusFeats(definition: Feats): { ref: ContentRef; bonus: FeatBonus }[] {
  const seen = new Map<string, { ref: ContentRef; bonus: FeatBonus }>();
  for (const { ref } of definition.feats) {
    if ("homebrewId" in ref) continue;
    const key = refKey(ref);
    const bonus = FEAT_BONUSES.get(key);
    if (bonus && !seen.has(key)) seen.set(key, { ref, bonus });
  }
  return [...seen.values()];
}

export function featInitiativeTerms(
  definition: Feats,
  proficiencyBonus: number,
): Term<TermReference>[] {
  return bonusFeats(definition).flatMap(({ ref, bonus: { initiative } }) =>
    initiative === undefined
      ? []
      : [
          {
            label: ref.name,
            value: initiative === "proficiency" ? proficiencyBonus : initiative,
            reference: ref,
          },
        ],
  );
}

export function featHitPointTerms(definition: Feats, level: number): Term<TermReference>[] {
  return bonusFeats(definition).flatMap(({ ref, bonus: { hitPointsPerLevel } }) =>
    hitPointsPerLevel === undefined
      ? []
      : [{ label: ref.name, value: hitPointsPerLevel * level, reference: ref }],
  );
}

/** Applied to the race's speed, so an item that sets or scales a speed reads the raised walk. */
export function speedWithFeats(
  base: Speed,
  definition: Feats,
): { speed: Speed; terms: Term<TermReference>[] } {
  let walk = base.walk;
  const terms: Term<TermReference>[] = [];
  if (walk === undefined) return { speed: base, terms };
  for (const { ref, bonus } of bonusFeats(definition)) {
    if (bonus.walk === undefined) continue;
    terms.push({ label: `${ref.name}: walk ${walk} to ${walk + bonus.walk}`, value: bonus.walk });
    walk += bonus.walk;
  }
  return { speed: { ...base, walk }, terms };
}
