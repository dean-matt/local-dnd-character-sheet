import type { FeatureGroup, SheetFeature } from "@dnd/catalog";
import {
  ACTION_TYPES,
  type ActionType,
  type CharacterDerived,
  type CharacterRecord,
  featureActionType,
} from "@dnd/character";
import { useCharacterFeatures } from "../../../../hooks/useCharacterFeatures.ts";
import { Card } from "../../../Card.tsx";
import { DetailTrigger } from "../../../DetailTrigger.tsx";
import { RulesEntries } from "../../../RulesEntries/RulesEntries.tsx";
import { FeatureDc } from "../../FeatureDc.tsx";
import { ActionRules } from "./ActionRules.tsx";
import { FeatureUse } from "./FeatureUse.tsx";
import { STANDARD_ACTIONS } from "./standardActions.ts";

type HeldFeature = Extract<SheetFeature, { resolved: true }> & {
  source: string;
  type: ActionType;
  group: FeatureGroup;
};

/** The resolved features the curated table maps to an action type, once each however many levels name them. */
function heldActions(groups: FeatureGroup[]): HeldFeature[] {
  const seen = new Set<string>();
  const held: HeldFeature[] = [];
  for (const { feature, group } of groups.flatMap((group) =>
    group.features.map((feature) => ({ feature, group })),
  )) {
    if (!feature.resolved || !feature.source) continue;
    const type = featureActionType({ name: feature.name, source: feature.source });
    const key = `${feature.name}|${feature.source}`;
    if (!type || seen.has(key)) continue;
    seen.add(key);
    held.push({ ...feature, source: feature.source, type, group });
  }
  return held;
}

/** The limited uses of the feature named `name` in any group, where it has any. */
function usesOfFeature(groups: FeatureGroup[], name: string) {
  for (const { features } of groups)
    for (const feature of features)
      if (feature.resolved && feature.name === name) return feature.uses;
  return undefined;
}

/** How many attacks the Attack action allows, where held features raise it past one, then each higher count under its condition. */
function attackCount({
  attacks,
  pactAttacks,
  conditionalAttacks,
}: CharacterDerived["turn"]): string | null {
  const counts = [
    pactAttacks
      ? `${pactAttacks} attacks with the pact weapon`
      : attacks > 1
        ? `${attacks} attacks`
        : null,
    ...conditionalAttacks.map(
      ({ attacks: count, option, feature }) => `${count} attacks ${option} (${feature})`,
    ),
  ].filter(Boolean);
  return counts.length > 0 ? counts.join("; ") : null;
}

/**
 * The Actions card: the standard actions the character's edition prints, the standard actions
 * held features let the character take as a bonus action, then the features the character
 * holds that take an action, grouped by the kind of action each takes. A name is a button that
 * opens the catalog's rules text for it, beside the resource it spends and a Use control. The
 * Attack action says how many attacks it allows where a feature raises it.
 */
export function Actions({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const actions = STANDARD_ACTIONS[character.definition.edition];
  const sourceOf = (name: string) =>
    [...actions, ...STANDARD_ACTIONS.classic].find((action) => action.name === name)?.source ??
    "PHB";
  const attacks = attackCount(derived.turn);
  const groups = useCharacterFeatures(character.id, derived).data?.groups ?? [];
  const held = heldActions(groups);
  return (
    <Card title="Actions">
      <div className="flex flex-col gap-2">
        {ACTION_TYPES.map((type) => {
          const group = actions.filter((action) => action.type === type);
          const features = held.filter((feature) => feature.type === type);
          const granted = type === "bonus action" ? derived.turn.bonusActions : [];
          if (group.length === 0 && features.length === 0 && granted.length === 0) return null;
          return (
            <div key={type}>
              <h4 className="font-semibold text-label text-muted capitalize">{type}</h4>
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-body">
                {group.map(({ name, source }) => (
                  <li key={name} className="flex min-h-6 items-center">
                    <DetailTrigger
                      title={name}
                      meta={type}
                      detail={<ActionRules name={name} source={source} />}
                      className="hover:underline"
                    >
                      {name}
                    </DetailTrigger>
                    {name === "Attack" && attacks && (
                      <span className="ml-1.5 text-muted text-row">{attacks}</span>
                    )}
                  </li>
                ))}
                {granted.map(({ action, features }) => (
                  <li key={action} className="flex min-h-6 items-center">
                    <DetailTrigger
                      title={action}
                      meta={`${type} • ${features.join(", ")}`}
                      detail={<ActionRules name={action} source={sourceOf(action)} />}
                      className="hover:underline"
                    >
                      {action}
                    </DetailTrigger>
                    <span className="ml-1.5 text-muted text-row">via {features.join(", ")}</span>
                  </li>
                ))}
                {features.map(({ name, source, entries, uses, group }) => (
                  <li key={`${name}|${source}`} className="flex min-h-6 items-center gap-1.5">
                    <DetailTrigger
                      title={name}
                      meta={`Feature • ${type}`}
                      detail={<RulesEntries entries={entries} />}
                      className="hover:underline"
                    >
                      {name}
                    </DetailTrigger>
                    <FeatureDc
                      character={character}
                      derived={derived}
                      name={name}
                      source={source}
                    />
                    <FeatureUse
                      character={character}
                      derived={derived}
                      name={name}
                      source={source}
                      type={type}
                      group={group}
                      uses={uses}
                      usesOf={(sibling) => usesOfFeature(groups, sibling)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
