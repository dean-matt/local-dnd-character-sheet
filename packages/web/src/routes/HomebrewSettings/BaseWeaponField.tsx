import type { ReactNode } from "react";
import { FormField } from "../../components/FormField.tsx";
import { Select } from "../../components/Select.tsx";
import { useBaseWeapons } from "../../hooks/useBaseWeapons.ts";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";
import type { HomebrewFormProps } from "./homebrewEntry.ts";
import { NOT_STATED } from "./homebrewOptions.ts";

const uid = (weapon: { name: string; source: string }) => `${weapon.name}|${weapon.source}`;

/**
 * The weapon a homebrew weapon is built on, picked from the edition's catalog base weapons
 * and written `name|source` as the catalog spells it, which proficiency and mastery resolve.
 * A saved `baseItem` no base weapon of the edition matches, pasted or left over from the
 * other edition, stays an option under its own spelling, marked, and saves unchanged. While
 * the list loads, or after it fails, the field offers only that value and Not stated, so it
 * can still be cleared.
 */
export function BaseWeaponField({
  current,
  edition,
  error,
  onChange,
}: {
  current: string;
  edition: HomebrewFormProps["edition"];
  error: ReactNode;
  onChange: (baseItem: string | undefined) => void;
}) {
  const query = useBaseWeapons(edition);
  const weapons = query.data?.items ?? [];
  const editions = `${EDITION_LABELS[edition]} base weapons`;
  const saved = weapons.find((weapon) => uid(weapon).toLowerCase() === current.toLowerCase());
  const unknown = current !== "" && !saved;
  const options = [
    NOT_STATED,
    ...weapons.map((weapon) => ({ value: uid(weapon), label: weapon.name })),
    ...(unknown
      ? [{ value: current, label: current, ...(query.isSuccess && { hint: "not found" }) }]
      : []),
  ];

  function mark() {
    if (query.isError) return `The ${editions} failed to load: ${query.error.message}`;
    return query.isSuccess && unknown ? `Not found among the ${editions}` : undefined;
  }

  return (
    <FormField
      label="Base weapon"
      error={error || mark()}
      status={query.isPending && `Loading the ${editions}…`}
    >
      {(control) => (
        <Select
          {...control}
          options={options}
          value={saved ? uid(saved) : current}
          onChange={(next) => onChange(next || undefined)}
        />
      )}
    </FormField>
  );
}
