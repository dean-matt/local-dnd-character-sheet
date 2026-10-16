import type { ReactNode } from "react";
import { useId, useState } from "react";
import { InputField } from "../../components/InputField.tsx";
import { useBaseWeapons } from "../../hooks/useBaseWeapons.ts";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";
import type { HomebrewFormProps } from "./homebrewEntry.ts";

const uid = (weapon: { name: string; source: string }) => `${weapon.name}|${weapon.source}`;

/**
 * The weapon a homebrew weapon is built on, picked by name from the edition's catalog base
 * weapons and written `name|source` as the catalog spells it, which proficiency and mastery
 * resolve. Text that names no base weapon stays in the field and writes nothing, marked once
 * no base weapon's name starts with it; leaving the field shows the saved value again. The
 * field is read-only until the list loads, saying so, since a typed name has nothing to
 * match until then. A saved `baseItem` no base weapon of the
 * edition matches, pasted or left over from the other edition, shows as written, marked, and
 * saves unchanged.
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
  const list = useId();
  const query = useBaseWeapons(edition);
  const weapons = query.data?.items;
  const [draft, setDraft] = useState<string>();
  const saved = weapons?.find((weapon) => uid(weapon).toLowerCase() === current.toLowerCase());
  const named = (text: string) =>
    weapons?.find((weapon) => weapon.name.toLowerCase() === text.trim().toLowerCase());
  const editions = `${EDITION_LABELS[edition]} base weapons`;

  function mark() {
    if (query.isError) return `The ${editions} failed to load: ${query.error.message}`;
    if (!weapons) return undefined;
    if (draft !== undefined) {
      const typed = draft.trim().toLowerCase();
      const leads = weapons.some((weapon) => weapon.name.toLowerCase().startsWith(typed));
      return leads ? undefined : `Pick one of the ${editions}`;
    }
    return current && !saved ? `Not found among the ${editions}` : undefined;
  }

  return (
    <>
      <InputField
        label="Base weapon"
        placeholder="Longsword"
        list={list}
        autoComplete="off"
        readOnly={!weapons}
        status={query.isPending && `Loading the ${editions}…`}
        value={draft ?? saved?.name ?? current}
        error={error || mark()}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          if (text.trim() === "") onChange(undefined);
          else {
            const weapon = named(text);
            if (weapon) onChange(uid(weapon));
          }
        }}
        onBlur={() => setDraft(undefined)}
      />
      <datalist id={list}>
        {weapons?.map((weapon) => (
          <option key={uid(weapon)} value={weapon.name} label={weapon.source} />
        ))}
      </datalist>
    </>
  );
}
