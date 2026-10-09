/**
 * A definition's choices of feature, read and written by the offering feature's whole key:
 * `Totem Spirit` (PHB) at level 3 and at level 6 are two choices.
 */
import {
  type CharacterDefinition,
  type ContentRef,
  type FeatureKey,
  featureKey,
  refKey,
} from "@dnd/character";

type Choices = CharacterDefinition["featureChoices"];

/** The option of `options` stored for `feature`, `undefined` where none of them is. */
export function takenOption(
  choices: Choices | undefined,
  feature: FeatureKey,
  options: readonly ContentRef[],
): ContentRef | undefined {
  const key = featureKey(feature);
  const taken = (choices?.find((choice) => featureKey(choice.feature) === key)?.options ?? []).map(
    refKey,
  );
  return options.find((option) => taken.includes(refKey(option)));
}

/** The options a reader sees: each from a source they left on, and `taken` whatever its source. */
export const shownOptions = (
  options: readonly ContentRef[],
  taken: ContentRef | undefined,
  disabled: readonly string[],
): ContentRef[] =>
  options.filter((option) => option === taken || !disabled.includes(option.source));

/** `choices` with `feature`'s options replaced by `options`, or a choice added last. */
export function withFeatureChoice(
  choices: Choices | undefined,
  feature: FeatureKey,
  options: ContentRef[],
): Choices {
  const key = featureKey(feature);
  const next = { feature, options };
  const held = choices ?? [];
  return held.some((choice) => featureKey(choice.feature) === key)
    ? held.map((choice) => (featureKey(choice.feature) === key ? next : choice))
    : [...held, next];
}
