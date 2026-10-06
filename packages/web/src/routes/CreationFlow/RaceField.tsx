import { proficiencyGrantsSchema, type SubraceRecord } from "@dnd/catalog";
import { type CharacterDefinition, displayName, type EntryRef } from "@dnd/character";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CatalogPicker } from "../../components/CatalogPicker/CatalogPicker.tsx";
import { ChoicePills } from "./ChoicePills.tsx";
import { ChosenChip } from "./ChosenChip.tsx";
import { withDeparture } from "./departures.ts";
import { grantNames, titleCase } from "./grants.ts";
import { RaceEscape } from "./RaceEscape.tsx";
import { raceChoices } from "./raceChoices.ts";
import { CUSTOM_RACE_SOURCE, useIdentityCatalog } from "./useIdentityCatalog.ts";

const OPTS = { shouldDirty: true } as const;

const subraceKey = (row: { name: string; source: string }) => `${row.name}|${row.source}`;

/** A race's entry names: the traits the sheet lists under Race Features. */
function traitNames(json: { entries?: unknown } | undefined): string[] {
  const entries = Array.isArray(json?.entries) ? json.entries : [];
  return entries.flatMap((entry) =>
    typeof entry === "object" && entry !== null && "name" in entry && typeof entry.name === "string"
      ? [entry.name]
      : [],
  );
}

/**
 * The race, chosen through the picker or typed past it, then whatever the race leaves
 * open: its subrace, its size and its resistance. A race with subraces and no plain variant
 * says it waits on one. A typed race writes a departure, since the sheet derives nothing
 * from a race the catalog lacks.
 */
export function RaceField() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const [race, subrace, size, raceResistance] = useWatch<
    CharacterDefinition,
    ["race", "subrace", "size", "raceResistance"]
  >({ name: ["race", "subrace", "size", "raceResistance"] });
  const { edition, catalogRace, subraces, raceJson } = useIdentityCatalog();
  const [moved, setMoved] = useState(false);

  function choose(ref: EntryRef | undefined, note?: string) {
    setValue("race", ref as EntryRef, OPTS);
    setValue("subrace", undefined, OPTS);
    setValue("departures", withDeparture(getValues("departures"), "race", note), OPTS);
    setMoved(true);
  }

  if (race === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <CatalogPicker
          label="Race"
          edition={edition}
          type="race"
          placeholder="Choose a race…"
          focusOnMount={moved}
          onPick={(ref) => choose(ref)}
        />
        <RaceEscape
          onUse={(name) =>
            choose(
              { name, source: CUSTOM_RACE_SOURCE },
              `${name} is not a race the catalog holds, so the sheet derives nothing from it.`,
            )
          }
        />
      </div>
    );
  }

  const rows: SubraceRecord[] = subraces.data?.items ?? [];
  const plain = rows.some((row) => row.name === "");
  const named = rows.filter((row) => row.name !== "");
  const { sizes, resistances } = raceChoices(raceJson);
  const grants = raceJson && grantNames(proficiencyGrantsSchema.parse(raceJson));
  const traits = traitNames(raceJson);

  return (
    <div className="flex flex-col">
      <ChosenChip
        label="Race"
        value={displayName(race)}
        focusOnMount={moved}
        onClear={() => choose(undefined)}
      />
      {catalogRace && grants && grants.length > 0 && (
        <p className="mt-1.5 text-muted text-row">Grants: {grants.join(", ")}</p>
      )}
      {catalogRace && traits.length > 0 && (
        <p className="mt-1 text-muted text-row">Traits: {traits.join(", ")}</p>
      )}
      {named.length > 0 && (
        <ChoicePills
          legend={
            plain
              ? `Subrace of ${displayName(race)}`
              : `${displayName(race)} has subraces — choose one to continue`
          }
          prompting={!plain && subrace === undefined}
          options={[
            ...(plain ? [{ value: "", label: "None" }] : []),
            ...named.map((row) => ({ value: subraceKey(row), label: row.name })),
          ]}
          value={subrace ? subraceKey(subrace) : plain ? "" : undefined}
          onChange={(value) => {
            const row = named.find((each) => subraceKey(each) === value);
            setValue("subrace", row && { name: row.name, source: row.source }, OPTS);
          }}
        />
      )}
      {sizes.length > 0 && (
        <ChoicePills
          legend="Size"
          prompting={!sizes.some((each) => each === size)}
          options={sizes.map((each) => ({ value: each, label: titleCase(each) }))}
          value={size}
          onChange={(value) => setValue("size", value as CharacterDefinition["size"], OPTS)}
        />
      )}
      {resistances.length > 0 && (
        <ChoicePills
          legend="Damage resistance"
          prompting={!resistances.includes(raceResistance ?? "")}
          options={resistances.map((each) => ({ value: each, label: titleCase(each) }))}
          value={raceResistance}
          onChange={(value) => setValue("raceResistance", value, OPTS)}
        />
      )}
    </div>
  );
}
