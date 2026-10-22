/**
 * What one level moved, as the level-up summary lists it: each value read before and after,
 * and the features that arrived. A value that did not move is left out.
 */
import type { ClassGrants } from "@dnd/catalog";
import type { CharacterDerived, Derived } from "@dnd/character";
import { featureTypeLabel } from "../../../lib/featureTypeLabel.ts";
import { ORDINAL } from "../../../lib/spellLevel.ts";
import { signed } from "../signed.ts";

export type LevelChange = { label: string; before: string; after: string };

type Table = Pick<ClassGrants, "resources" | "optionalFeatures">;

const NONE = "none";

/** `ki_points` as `Ki points`. */
const resourceLabel = (key: string) => {
  const words = key.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A field the player typed over shows what stands and the computed value beneath it. */
function shown(
  field: Derived<number> | undefined,
  format: (value: number) => string = String,
): string {
  if (field === undefined) return NONE;
  if (field.manual === null) return format(field.computed);
  return `${format(field.manual)} (your override; computed ${format(field.computed)})`;
}

function moved(label: string, before: string, after: string): LevelChange[] {
  return before === after ? [] : [{ label, before, after }];
}

/**
 * The hit point maximum, proficiency bonus and spell slots that differ between two derived
 * blocks. An override shows beside its computed value, so a level-up that moves only the
 * computed side still says so.
 */
export function derivedChanges(before: CharacterDerived, after: CharacterDerived): LevelChange[] {
  const slotLevels = [
    ...new Set([...before.spellSlots, ...after.spellSlots].map((slot) => slot.level)),
  ].sort((a, b) => a - b);
  const slotAt = (derived: CharacterDerived, level: number) =>
    derived.spellSlots.find((slot) => slot.level === level)?.total;
  const pact = (derived: CharacterDerived) =>
    derived.pactSlots
      ? `${shown(derived.pactSlots.total)} at ${ORDINAL[derived.pactSlots.level]} level`
      : NONE;
  return [
    ...moved("Hit point maximum", shown(before.hitPointMaximum), shown(after.hitPointMaximum)),
    ...moved(
      "Proficiency bonus",
      shown(before.proficiencyBonus, signed),
      shown(after.proficiencyBonus, signed),
    ),
    ...slotLevels.flatMap((level) =>
      moved(
        `${ORDINAL[level]}-level spell slots`,
        shown(slotAt(before, level)),
        shown(slotAt(after, level)),
      ),
    ),
    ...moved("Pact slots", pact(before), pact(after)),
  ];
}

/** The class table's resources and option counts that differ between two of its rows. */
export function tableChanges(before: Table | undefined, after: Table): LevelChange[] {
  const resourceKeys = [
    ...new Set([...(before?.resources ?? []), ...after.resources].map((each) => each.resourceKey)),
  ];
  const resource = (table: Table | undefined, key: string) =>
    table?.resources.find((each) => each.resourceKey === key)?.value ?? NONE;
  const types = [
    ...new Set(
      [...(before?.optionalFeatures ?? []), ...after.optionalFeatures].map(
        (each) => each.featureType,
      ),
    ),
  ];
  const known = (table: Table | undefined, type: string) =>
    String(table?.optionalFeatures.find((each) => each.featureType === type)?.known ?? 0);
  return [
    ...resourceKeys.flatMap((key) =>
      moved(resourceLabel(key), resource(before, key), resource(after, key)),
    ),
    ...types.flatMap((type) =>
      moved(`${featureTypeLabel(type)} options known`, known(before, type), known(after, type)),
    ),
  ];
}

/**
 * The features gained from level `from` through `to`, without the options a feature offers
 * beside them, which the level-up asks for as a choice instead.
 */
export const featuresAt = (
  features: ClassGrants["features"],
  from: number,
  to = from,
): string[] => [
  ...new Set(
    features
      .filter(
        (feature) =>
          feature.level >= from && feature.level <= to && feature.offeredBy === undefined,
      )
      .map((feature) => feature.name),
  ),
];
