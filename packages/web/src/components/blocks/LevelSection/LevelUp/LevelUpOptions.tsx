import { displayName, entryKey, grantorKey } from "@dnd/character";
import { featureTypeLabel } from "../../../../lib/featureTypeLabel.ts";
import {
  optionalFeatureJudge,
  prerequisiteFacts,
} from "../../../../lib/optionalFeaturePrerequisites.ts";
import { PickField } from "../../../PickField.tsx";
import type { useLevelUpPlan } from "./useLevelUpPlan.ts";

/**
 * The optional features the level adds, one list per type and grantor, each picked from the
 * options of that type in the grantor's edition. An option whose prerequisite the character
 * misses at the new level is listed and cannot be picked.
 */
export function LevelUpOptions({ plan }: { plan: ReturnType<typeof useLevelUpPlan> }) {
  const { gains, add, remove } = plan.optionPicks;
  const facts = prerequisiteFacts(plan.draft);
  const types = gains.map((gain) => gain.featureType);
  return gains.map((gain) => {
    const label = featureTypeLabel(gain.featureType);
    // A class and its subclass growing one type at one level each get a list, told apart by name.
    const shared = types.indexOf(gain.featureType) !== types.lastIndexOf(gain.featureType);
    const held = plan.draft.optionalFeatures.filter(
      (pick) => pick.featureType === gain.featureType,
    );
    return (
      <PickField
        key={`${gain.featureType}|${grantorKey(gain.grantedBy)}`}
        heading={`New ${label}${shared ? ` from ${displayName(gain.grantedBy.ref)}` : ""}`}
        noun={label.toLowerCase()}
        count={gain.count}
        picked={gain.picked.map(({ ref }) => ({ ref, name: displayName(ref) }))}
        edition={gain.edition}
        type="optfeature"
        filters={{ featureType: gain.featureType }}
        {...optionalFeatureJudge(facts, new Set(held.map((pick) => entryKey(pick.ref))))}
        onPick={(ref) => add(gain, ref)}
        onRemove={(ref) => remove(gain, ref)}
      />
    );
  });
}
