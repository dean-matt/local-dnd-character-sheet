import { type CharacterRecord, entryKey, raceSummary } from "@dnd/character";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { useSubraces } from "../../../hooks/useSubraces.ts";
import { RACE_FIELD, withDeparture } from "../../../lib/departures.ts";
import { Card } from "../../Card.tsx";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";
import { ChangeablePick } from "./ChangeablePick.tsx";

const subraceKey = (row: { name: string; source: string }) => `${row.name}|${row.source}`;

/**
 * The race, changed through the picker, and its subrace where the catalog race has named
 * ones. A new race drops the subrace and any note that the old one was typed past the
 * catalog; what the new race grants is left for the player to apply.
 */
export function RaceCard({ character }: { character: CharacterRecord }) {
  const { definition } = character;
  const write = useHeldSave(character.id, "Race");
  const { race, subrace, edition } = definition;
  const subraces = useSubraces("name" in race ? race : undefined, edition);
  const rows = subraces.data?.items ?? [];
  const plain = rows.some((row) => row.name === "");
  const named = rows.filter((row) => row.name !== "");

  return (
    <Card title="Race">
      <div className="flex flex-col gap-2">
        <ChangeablePick
          noun="race"
          value={raceSummary(definition)}
          edition={edition}
          type="race"
          onPick={(ref) => {
            if (entryKey(ref) === entryKey(race)) return;
            write("race", (latest) => ({
              ...latest,
              race: ref,
              subrace: undefined,
              departures: withDeparture(latest.departures, RACE_FIELD),
            }));
          }}
        />
        {named.length > 0 && (
          <FormField label="Subrace">
            {(control) => (
              <Select
                {...control}
                options={[
                  { value: "", label: plain ? "None" : "Choose a subrace" },
                  ...named.map((row) => ({ value: subraceKey(row), label: row.name })),
                ]}
                value={subrace ? subraceKey(subrace) : ""}
                onChange={(value) => {
                  const row = named.find((each) => subraceKey(each) === value);
                  write("subrace", (latest) => ({
                    ...latest,
                    subrace: row && { name: row.name, source: row.source },
                  }));
                }}
              />
            )}
          </FormField>
        )}
      </div>
    </Card>
  );
}
