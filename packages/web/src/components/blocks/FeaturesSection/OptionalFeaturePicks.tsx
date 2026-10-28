import {
  type CharacterDefinition,
  type CharacterRecord,
  displayName,
  type EntryRef,
  entryKey,
  grantorKey,
  type OptionalFeatureTally,
  spareEntitlement,
} from "@dnd/character";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { useHomebrewNames } from "../../../hooks/useHomebrewNames.ts";
import { featureTypeLabel, featureTypeNoun } from "../../../lib/featureTypeLabel.ts";
import {
  optionalFeatureJudge,
  prerequisiteFacts,
} from "../../../lib/optionalFeaturePrerequisites.ts";
import { PickField } from "../../PickField.tsx";
import { EntitlementNote } from "./EntitlementNote.tsx";

type Pick = CharacterDefinition["optionalFeatures"][number];

/**
 * The options of each type the character is entitled to or holds: how many, from what, and
 * each pick removed, swapped or added through the picker, which lists the options of that
 * type in the edition the entitlement offers. Every change saves through the definition, so
 * each lands in the undo log.
 */
export function OptionalFeaturePicks({
  character,
  tallies,
}: {
  character: CharacterRecord;
  tallies: readonly OptionalFeatureTally[];
}) {
  const names = useHomebrewNames();
  const write = useHeldSave(character.id, "Optional features");
  const facts = prerequisiteFacts(character.definition);
  return (
    <div className="flex flex-col gap-3 border-border border-t pt-3 print:hidden">
      {tallies.map((tally) => {
        const { featureType } = tally;
        const spare = spareEntitlement(tally);
        const grantedBy = spare?.grantedBy ?? tally.picks[0]?.grantedBy;
        const label = featureTypeLabel(featureType);
        const same = (ref: EntryRef) => (pick: Pick) =>
          pick.featureType === featureType && entryKey(pick.ref) === entryKey(ref);
        const edit = (key: string, change: (picks: Pick[]) => Pick[]) =>
          write(`${featureType}:${key}`, (latest) => ({
            ...latest,
            optionalFeatures: change(latest.optionalFeatures),
          }));
        const judge = optionalFeatureJudge(
          facts,
          // Held under any type: one fighting style is never taken twice, though four classes offer it.
          new Set(character.definition.optionalFeatures.map((pick) => entryKey(pick.ref))),
        );
        return (
          <PickField
            key={featureType}
            heading={label}
            headingLevel="h4"
            noun={featureTypeNoun(featureType)}
            count={tally.known}
            note={<EntitlementNote tally={tally} />}
            picked={tally.picks.map(({ ref }) => ({ ref, name: displayName(ref, names) }))}
            edition={spare?.edition ?? character.definition.edition}
            replaceEdition={(ref) => {
              const pick = tally.picks.find(same(ref));
              return tally.entitlements.find(
                (each) => pick && grantorKey(each.grantedBy) === grantorKey(pick.grantedBy),
              )?.edition;
            }}
            type="optfeature"
            filters={{ featureType }}
            {...judge}
            onPick={(ref) =>
              grantedBy &&
              edit(`add:${entryKey(ref)}`, (picks) =>
                picks.some(same(ref)) ? picks : [...picks, { ref, featureType, grantedBy }],
              )
            }
            onRemove={(ref) =>
              edit(`remove:${entryKey(ref)}`, (picks) => picks.filter((pick) => !same(ref)(pick)))
            }
            onReplace={(old, ref) =>
              edit(`replace:${entryKey(old)}`, (picks) =>
                picks.some(same(ref))
                  ? picks
                  : picks.map((pick) => (same(old)(pick) ? { ...pick, ref } : pick)),
              )
            }
          />
        );
      })}
    </div>
  );
}
