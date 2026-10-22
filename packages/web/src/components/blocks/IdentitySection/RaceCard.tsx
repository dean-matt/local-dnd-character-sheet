import {
  type CharacterDefinition,
  type CharacterRecord,
  entryKey,
  houseRule,
  raceSummary,
} from "@dnd/character";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { RACE_FIELD, withDeparture } from "../../../lib/departures.ts";
import { increaseSource } from "../../../lib/grantorIncreases.ts";
import { titleCase } from "../../../lib/proficiencyGrants.ts";
import { raceChoices } from "../../../lib/raceChoices.ts";
import { Card } from "../../Card.tsx";
import { ChoicePills } from "../../ChoicePills.tsx";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";
import { ChangeablePick } from "./ChangeablePick.tsx";
import { OriginIncreases } from "./OriginIncreases.tsx";
import { OriginSpellBlocks } from "./OriginSpellBlocks.tsx";
import { useRaceRow } from "./useRaceRow.ts";

const subraceKey = (row: { name: string; source: string }) => `${row.name}|${row.source}`;

/**
 * The race, changed through the picker, its subrace where the catalog race has named ones,
 * and what the race leaves open: its size, its resistance, its increases and which of its
 * spell blocks applies. A new race drops the subrace and any note that the old one was
 * typed past the catalog; what it grants is left for the player to apply.
 */
export function RaceCard({ character }: { character: CharacterRecord }) {
  const { definition } = character;
  const write = useHeldSave(character.id, "Race");
  const { race, subrace, size, raceResistance } = definition;
  const { catalogRace, subraces, ready, json } = useRaceRow(definition);
  const plain = subraces.some((row) => row.name === "");
  const named = subraces.filter((row) => row.name !== "");
  const { sizes, resistances } = raceChoices(json);

  return (
    <Card title="Race">
      <div className="flex flex-col gap-2">
        <ChangeablePick
          noun="race"
          value={raceSummary(definition)}
          edition={definition.edition}
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
        {sizes.length > 0 && (
          <ChoicePills
            legend="Size"
            options={sizes.map((each) => ({ value: each, label: titleCase(each) }))}
            value={size}
            onChange={(value) =>
              write("size", (latest) => ({
                ...latest,
                size: value as CharacterDefinition["size"],
              }))
            }
          />
        )}
        {resistances.length > 0 && (
          <ChoicePills
            legend="Damage resistance"
            options={resistances.map((each) => ({ value: each, label: titleCase(each) }))}
            value={raceResistance}
            onChange={(value) =>
              write("raceResistance", (latest) => ({ ...latest, raceResistance: value }))
            }
          />
        )}
        {ready && (
          <OriginIncreases
            definition={definition}
            source={increaseSource(
              "race",
              raceSummary(definition),
              catalogRace && json,
              houseRule(definition, "customOrigin"),
            )}
            write={write}
          />
        )}
        <OriginSpellBlocks
          definition={definition}
          row={
            catalogRace &&
            (subrace
              ? { grantor: "subrace", ref: subrace, parent: catalogRace }
              : { grantor: "race", ref: catalogRace })
          }
          kinds={["race", "subrace"]}
          write={write}
        />
      </div>
    </Card>
  );
}
