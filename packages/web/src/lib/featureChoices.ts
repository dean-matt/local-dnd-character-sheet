/**
 * A definition's choices of feature, read and written by the offering feature's whole key:
 * `Totem Spirit` (PHB) at level 3 and at level 6 are two choices.
 */
import {
  type CharacterDefinition,
  type ContentRef,
  type FeatureKey,
  featureKey,
} from "@dnd/character";

type Choices = CharacterDefinition["featureChoices"];

/** The options stored for `feature`, none where it has no choice yet. */
export function chosenOptions(choices: Choices | undefined, feature: FeatureKey): ContentRef[] {
  const key = featureKey(feature);
  return choices?.find((choice) => featureKey(choice.feature) === key)?.options ?? [];
}

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
