import { type CharacterDerived, type CharacterRecord, overrideKey } from "@dnd/character";
import { DerivedValue } from "./DerivedValue.tsx";

/**
 * The save DC a held feature sets, beside the feature's name, behind the terms it adds up
 * from. Nothing shows for a feature that sets none, or before the derived block loads.
 */
export function FeatureDc({
  character,
  derived,
  name,
  source,
}: {
  character: CharacterRecord;
  derived: CharacterDerived | undefined;
  name: string;
  source: string | undefined;
}) {
  const dc = derived?.featureDcs.find(
    ({ feature }) => feature.name === name && feature.source === source,
  );
  if (!dc) return null;
  return (
    <span className="flex items-center gap-1 text-muted text-row">
      {dc.label} DC
      <DerivedValue
        named
        name={`${dc.label} DC`}
        value={dc.saveDc}
        format={String}
        overrideKey={`${overrideKey("featureDcs", dc, character.definition)}.saveDc`}
      />
    </span>
  );
}
