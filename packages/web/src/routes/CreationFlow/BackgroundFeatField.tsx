import { type CharacterDefinition, entryKey } from "@dnd/character";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { ChoicePills } from "../../components/ChoicePills.tsx";
import { searchHitKey } from "../../lib/searchHitKey.ts";
import { setRefValue } from "../../lib/setRefValue.ts";
import { sharedNameLabel } from "../../lib/sharedNameLabel.ts";
import { heldFromBackground, withBackgroundPick, withFeatBlock } from "./backgroundFeats.ts";
import { useBackgroundFeats } from "./useBackgroundFeats.ts";

/**
 * Keeps the background's feat in `feats`: a fixed one lands without a question, and a
 * background offering several asks which one. Changing the background takes back the feat
 * the old one granted.
 */
export function BackgroundFeatField() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const { background, offers, feats, next } = useBackgroundFeats();

  // biome-ignore lint/correctness/useExhaustiveDependencies: `next` is `feats` itself until something changes.
  useEffect(() => {
    if (next !== feats) setRefValue(setValue, "feats", next, { shouldDirty: true });
  }, [next]);

  const [only] = offers?.options ?? [];
  const block = offers?.fixed ? only?.block : undefined;
  const backgroundKey = background && entryKey(background);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the list is set when the background or its list changes, so a later choice on the Spells step stands.
  useEffect(() => {
    if (only && "source" in only && block !== undefined)
      setRefValue(
        setValue,
        "spellBlocks",
        withFeatBlock(getValues("spellBlocks") ?? [], only, block),
        {
          shouldDirty: true,
        },
      );
  }, [backgroundKey, block]);

  if (offers === undefined || background === undefined || offers.options.length === 0) return null;
  const [held] = heldFromBackground(feats);
  const label = sharedNameLabel(offers.options);
  if (offers.fixed) {
    return (
      <p className="mt-1.5 text-muted text-row">
        Feat: {only?.name}
        {only?.list && ` (${only.list})`}
      </p>
    );
  }
  return (
    <ChoicePills
      legend="Background feat"
      prompting={held === undefined}
      options={offers.options.map((row) => ({ value: searchHitKey(row), label: label(row) }))}
      value={held && entryKey(held.ref)}
      onChange={(value) => {
        const row = offers.options.find((each) => searchHitKey(each) === value);
        if (row)
          setRefValue(setValue, "feats", withBackgroundPick(feats, background, row), {
            shouldDirty: true,
          });
      }}
    />
  );
}
