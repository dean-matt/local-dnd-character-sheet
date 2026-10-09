/**
 * The choice a character makes at each Ability Score Improvement or Epic Boon its classes
 * grant, read and written by the character level it was taken at. A feat taken there is a
 * `feats` entry its class granted at that level; the increases are `abilityIncreases`
 * entries at that level, granted by the class where a classic character raised scores
 * without a feat and by the feat otherwise.
 *
 * A level is one level of one class, and no class level grants an improvement beside
 * another feat, so a class-granted feat at an improvement's level is that improvement's.
 */
import type { CharacterDefinition } from "./definition.ts";
import type { Ability, ContentRef, EntryRef } from "./refs.ts";

type Held = Pick<CharacterDefinition, "feats" | "abilityIncreases">;
type Feat = CharacterDefinition["feats"][number];

/** The feat a 2024 character takes to raise scores at an improvement. */
export const IMPROVEMENT_FEAT: ContentRef = { name: "Ability Score Improvement", source: "XPHB" };

/** One increase an improvement places. */
export type Raise = { ability: Ability; amount: number };

/**
 * What a character took at one improvement: the feat, absent where a classic character
 * raised scores instead, and every increase placed there, the feat's own included.
 */
export type Improvement = { feat?: EntryRef; increases: Raise[] };

const takenAt =
  (level: number) =>
  (feat: Feat): boolean =>
    feat.level === level && feat.grantedBy?.kind === "class";

/** The choice stored for the improvement at character level `level`, `undefined` where none is. */
export function improvementAt(definition: Held, level: number): Improvement | undefined {
  const feat = definition.feats.find(takenAt(level));
  const increases = definition.abilityIncreases
    .filter((increase) => increase.level === level)
    .map(({ ability, amount }) => ({ ability, amount }));
  if (feat) return { feat: feat.ref, increases };
  return increases.length > 0 ? { increases } : undefined;
}

/** `definition`'s feats and increases with the improvement at `level` cleared. */
export function withoutImprovement(definition: Held, level: number): Held {
  return {
    feats: definition.feats.filter((feat) => !takenAt(level)(feat)),
    abilityIncreases: definition.abilityIncreases.filter((increase) => increase.level !== level),
  };
}

/**
 * `definition`'s feats and increases with the improvement at `level` replaced by
 * `improvement`, granted by `cls`.
 */
export function withImprovement(
  definition: Held,
  level: number,
  cls: EntryRef,
  improvement: Improvement,
): Held {
  const { feats, abilityIncreases } = withoutImprovement(definition, level);
  const { feat, increases } = improvement;
  return {
    feats: feat ? [...feats, { ref: feat, grantedBy: { kind: "class", ref: cls }, level }] : feats,
    abilityIncreases: [
      ...abilityIncreases,
      ...increases.map(
        (raise) => ({ ...raise, grantedBy: feat ? "feat" : "class", level }) as const,
      ),
    ],
  };
}

/** The class that granted the feat taken at `level`, `undefined` where no feat was taken there. */
export const improvementGrantor = (definition: Held, level: number): EntryRef | undefined => {
  const grantor = definition.feats.find(takenAt(level))?.grantedBy;
  return grantor?.kind === "class" ? grantor.ref : undefined;
};

/** Names the improvement at `level` as a score's term: the feat taken there, or the improvement itself. */
export function improvementLabel(feats: readonly Feat[] | undefined, level: number): string {
  const ref = feats?.find(takenAt(level))?.ref;
  const named = ref && "name" in ref && ref.name !== IMPROVEMENT_FEAT.name;
  return `${named ? ref.name : "Ability Score Improvement"} (level ${level})`;
}
