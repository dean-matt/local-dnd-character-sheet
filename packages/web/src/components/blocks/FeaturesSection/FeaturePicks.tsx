import type { SheetFeature } from "@dnd/catalog";
import { type CharacterRecord, featureKey } from "@dnd/character";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { withFeaturePicks } from "../../../lib/featureChoices.ts";
import { OfferFields } from "../../OfferFields.tsx";

type FeaturePicksOffered = NonNullable<SheetFeature["picks"]>;

/**
 * The picks a class or subclass feature asks for — the skills of `Expertise` (PHB), the
 * languages of `Blessings of Knowledge` (PHB) — each saved as soon as it is picked. The feature
 * grants them only while the character holds it, so a pick for a feature since lost stays
 * stored and applies nothing.
 */
export function FeaturePicks({
  character,
  name,
  picks,
}: {
  character: CharacterRecord;
  name: string;
  picks: FeaturePicksOffered;
}) {
  const { definition } = character;
  const derived = useCharacterDerived(character.id).data;
  const write = useHeldSave(character.id, `${name} picks`);
  const key = featureKey(picks.feature);
  const stored = definition.featureChoices.find((choice) => featureKey(choice.feature) === key);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <OfferFields
        name={name}
        edition={definition.edition}
        proficiencies={definition.proficiencies}
        derived={derived}
        offers={picks.offers}
        picks={stored?.picks}
        onChange={(slot, change) =>
          write(`feature|${key}|${slot}`, (latest) => ({
            ...latest,
            featureChoices: withFeaturePicks(latest.featureChoices, picks.feature, change),
          }))
        }
      />
    </div>
  );
}
