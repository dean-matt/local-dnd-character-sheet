import { type CharacterDefinition, entryKey } from "@dnd/character";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { setRefValue } from "../../lib/setRefValue.ts";
import { heldFromBackground, withBackgroundPick } from "./backgroundFeats.ts";
import { ChoicePills } from "./ChoicePills.tsx";
import { useBackgroundFeats } from "./useBackgroundFeats.ts";

/**
 * Keeps the background's feat in `feats`: a fixed one lands without a question, and a
 * background offering several asks which one. Changing the background takes back the feat
 * the old one granted.
 */
export function BackgroundFeatField() {
  const { setValue } = useFormContext<CharacterDefinition>();
  const { background, offers, feats, next } = useBackgroundFeats();

  // biome-ignore lint/correctness/useExhaustiveDependencies: `next` is `feats` itself until something changes.
  useEffect(() => {
    if (next !== feats) setRefValue(setValue, "feats", next, { shouldDirty: true });
  }, [next]);

  if (offers === undefined || background === undefined || offers.options.length === 0) return null;
  const [held] = heldFromBackground(feats);
  if (offers.fixed) {
    const [only] = offers.options;
    return <p className="mt-1.5 text-muted text-row">Feat: {only?.name}</p>;
  }
  return (
    <ChoicePills
      legend="Background feat"
      prompting={held === undefined}
      options={offers.options.map((row) => ({ value: entryKey(row), label: row.name }))}
      value={held && entryKey(held.ref)}
      onChange={(value) => {
        const row = offers.options.find((each) => entryKey(each) === value);
        if (row)
          setRefValue(setValue, "feats", withBackgroundPick(feats, background, row), {
            shouldDirty: true,
          });
      }}
    />
  );
}
