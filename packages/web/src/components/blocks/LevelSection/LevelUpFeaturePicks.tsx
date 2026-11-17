import { type CharacterDefinition, featureKey } from "@dnd/character";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import type { FeaturePicking } from "../../../lib/featureOfferings.ts";
import { OfferFields } from "../../OfferFields.tsx";
import type { useLevelUpPlan } from "./useLevelUpPlan.ts";

/**
 * The picks one feature the level brings asks for, held in the draft's `featureChoices` until
 * Apply. A skill pick of expertise is offered from the proficiencies the draft holds.
 */
export function LevelUpFeaturePicks({
  characterId,
  edition,
  picking,
  plan,
}: {
  characterId: string;
  edition: CharacterDefinition["edition"];
  picking: FeaturePicking;
  plan: ReturnType<typeof useLevelUpPlan>;
}) {
  const derived = useCharacterDerived(characterId).data;
  const key = featureKey(picking.feature);
  const stored = plan.featureChoices.find((choice) => featureKey(choice.feature) === key);
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="font-semibold text-label text-muted uppercase">{picking.feature.name}</h3>
      <div className="flex flex-wrap items-end gap-2">
        <OfferFields
          name={picking.feature.name}
          edition={edition}
          proficiencies={plan.proficiencies}
          derived={derived}
          offers={picking.offers}
          picks={stored?.picks}
          onChange={(_, change) => plan.pick(picking, change)}
        />
      </div>
    </div>
  );
}
