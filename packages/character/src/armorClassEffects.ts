/**
 * The armor class a feature adds, read from the recorded feature mechanics. A subclass
 * feature is recorded under its subclass's short name, so `SUBCLASS_NAMES` maps it to the
 * full name a level stores, as `unarmoredDefense.ts` keys its formulas.
 */
import type { Term } from "@dnd/rules";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { featureMechanicsKey, mechanicsOfKind } from "./featureMechanics.ts";
import { refKey } from "./keys.ts";
import { type ContentRef, catalogRef } from "./refs.ts";
import { classLevels } from "./summaries.ts";

export const SUBCLASS_NAMES = new Map([["Forge|XGE", "Forge Domain|XGE"]]);

export type ArmorStance = {
  armor: "none" | "light" | "medium" | "heavy";
  /** Equipped melee weapons, one per hand at most. */
  meleeWeapons: number;
  dexterityScore: number;
};

export type ArmorClassEffects = {
  bonus: Term<TermReference>[];
  unarmoredBase: Term<TermReference> | undefined;
  mediumDexterityCap: number | undefined;
};

type Held = { ref: ContentRef; entry: (typeof FEATURE_MECHANICS)[number] };

const BY_KEY = new Map(FEATURE_MECHANICS.map((entry) => [featureMechanicsKey(entry), entry]));

const SUBCLASS_FEATURES = FEATURE_MECHANICS.flatMap((entry) => {
  const { ref } = entry;
  if (!("className" in ref) || !ref.subclass) return [];
  const subclass = SUBCLASS_NAMES.get(`${ref.subclass.shortName}|${ref.subclass.source}`);
  return subclass
    ? [
        {
          entry,
          ref: { name: ref.name, source: ref.source },
          key: `${ref.className}|${ref.classSource}|${subclass}`,
          level: ref.level,
        },
      ]
    : [];
});

/** Each catalog feat and option the character holds, once, and each subclass feature its level has reached. */
function heldFeatures(definition: CharacterDefinition): Held[] {
  const held = new Map<string, Held>();
  for (const { ref } of [...definition.feats, ...definition.optionalFeatures]) {
    const catalog = catalogRef(ref);
    const entry = catalog && BY_KEY.get(refKey(catalog));
    if (catalog && entry) held.set(refKey(catalog), { ref: catalog, entry });
  }
  for (const group of classLevels(definition)) {
    const subclass = catalogRef(group.subclass);
    if ("homebrewId" in group.class || !subclass) continue;
    const key = `${refKey(group.class)}|${refKey(subclass)}`;
    for (const feature of SUBCLASS_FEATURES)
      if (feature.key === key && group.level >= feature.level)
        held.set(`${key}|${feature.ref.name}`, { ref: feature.ref, entry: feature.entry });
  }
  return [...held.values()];
}

const holds = {
  armor: (stance: ArmorStance) => stance.armor !== "none",
  heavyArmor: (stance: ArmorStance) => stance.armor === "heavy",
  dualWield: (stance: ArmorStance) => stance.meleeWeapons >= 2,
};

function apply(effects: ArmorClassEffects, stance: ArmorStance, { ref, entry }: Held): void {
  for (const { value, when } of mechanicsOfKind(entry, "armorClass"))
    if (holds[when](stance)) effects.bonus.push({ label: ref.name, value, reference: ref });
  for (const { value } of mechanicsOfKind(entry, "unarmoredBase"))
    if (value > (effects.unarmoredBase?.value ?? 0))
      effects.unarmoredBase = { label: ref.name, value, reference: ref };
  for (const { cap, minimum } of mechanicsOfKind(entry, "mediumArmorDexterity"))
    if (stance.armor === "medium" && stance.dexterityScore >= minimum)
      effects.mediumDexterityCap = Math.max(effects.mediumDexterityCap ?? 0, cap);
}

export function armorClassEffects(
  definition: CharacterDefinition,
  stance: ArmorStance,
): ArmorClassEffects {
  const effects: ArmorClassEffects = {
    bonus: [],
    unarmoredBase: undefined,
    mediumDexterityCap: undefined,
  };
  for (const held of heldFeatures(definition)) apply(effects, stance, held);
  return effects;
}
