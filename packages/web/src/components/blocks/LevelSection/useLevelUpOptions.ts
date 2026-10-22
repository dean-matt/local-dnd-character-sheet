import {
  type CharacterDefinition,
  type EntryRef,
  entryKey,
  grantorKey,
  type OptionalFeatureEntitlement,
} from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { setRefValue } from "../../../lib/setRefValue.ts";
import { optionsGained } from "./optionsGained.ts";
import type { useLevelUpClass } from "./useLevelUpClass.ts";

type Pick = CharacterDefinition["optionalFeatures"][number];

/** Options of one type the level adds, spent under the class or subclass whose table grew. */
export type OptionGain = Omit<OptionalFeatureEntitlement, "known"> & { count: number };

const pickKey = (pick: Pick) => `${pick.featureType}|${entryKey(pick.ref)}`;

/**
 * The options the level adds under `cls` and its subclass, and the picks the draft's
 * `optionalFeatures` holds past `definition`'s for each, each stating the character level it
 * was picked at. A homebrew class counts none.
 *
 * A feat taken at this level that grants options, as `Martial Adept` (PHB) does, asks
 * nothing here: the Chosen Features card offers its picks once the level is applied.
 * Reading the draft's new feats against `granted_optional_features` is the way out.
 */
export function useLevelUpOptions(
  definition: CharacterDefinition,
  cls: EntryRef,
  target: ReturnType<typeof useLevelUpClass>,
  optionalFeatures: readonly Pick[],
) {
  const { setValue } = useFormContext<CharacterDefinition>();
  const catalog = "name" in cls ? cls : undefined;
  const { subclass } = target;
  const gains: OptionGain[] = catalog
    ? [
        ...optionsGained(target.before, target.after).map((gain) => ({
          ...gain,
          grantedBy: { kind: "class" as const, ref: catalog },
          edition: target.edition ?? definition.edition,
        })),
        ...(subclass
          ? optionsGained(target.subclassBefore, target.subclassAfter).map((gain) => ({
              ...gain,
              grantedBy: { kind: "subclass" as const, ref: subclass, class: catalog },
              edition: target.subclassRow?.edition ?? definition.edition,
            }))
          : []),
      ]
    : [];
  const prior = new Set(definition.optionalFeatures.map(pickKey));
  const added = optionalFeatures.filter((pick) => !prior.has(pickKey(pick)));
  const picked = (gain: OptionGain) =>
    added.filter(
      (pick) =>
        pick.featureType === gain.featureType &&
        grantorKey(pick.grantedBy) === grantorKey(gain.grantedBy),
    );
  const write = (next: Pick[]) =>
    setRefValue(setValue, "optionalFeatures", next, { shouldDirty: true });
  return {
    gains: gains.map((gain) => ({ ...gain, picked: picked(gain) })),
    ready: gains.every((gain) => picked(gain).length === gain.count),
    add: (gain: OptionGain, ref: EntryRef) => {
      const pick = {
        ref,
        featureType: gain.featureType,
        grantedBy: gain.grantedBy,
        level: definition.levels.length + 1,
      };
      if (optionalFeatures.some((each) => pickKey(each) === pickKey(pick))) return;
      write([...optionalFeatures, pick]);
    },
    remove: (gain: OptionGain, ref: EntryRef) => {
      const key = pickKey({ ref, featureType: gain.featureType, grantedBy: gain.grantedBy });
      write(optionalFeatures.filter((pick) => prior.has(pickKey(pick)) || pickKey(pick) !== key));
    },
  };
}
