import type { SheetItem } from "@dnd/catalog";
import { ABILITY_LABEL, type Ability, type CharacterRecord, refKey } from "@dnd/character";
import { z } from "zod";
import { CatalogPicker } from "../../../CatalogPicker/CatalogPicker.tsx";
import { Field } from "../../../Field/Field.tsx";
import { MultiSelect } from "../../../MultiSelect.tsx";
import { RemovableChipList } from "../../../RemovableChipList.tsx";
import type { InventoryEntry } from "./editInventoryEntry.ts";

type ResolvedItem = Extract<SheetItem, { resolved: true }>;

/** The pick is optional, so an empty input saves as no pick. */
const proficiencySchema = z.string().trim().max(100);

/**
 * The picks the item offers the wearer: which scores it raises, and the proficiency and
 * language it grants without naming. `edition` narrows the language search. Choosing a
 * score past `count` drops the oldest, and a cleared pick saves as none.
 */
export function ItemPicks({
  item,
  entry,
  edition,
  busy,
  onAbilities,
  onProficiency,
  onLanguage,
}: {
  item: ResolvedItem;
  entry: InventoryEntry;
  edition: CharacterRecord["edition"];
  busy: boolean;
  onAbilities: (picks: Ability[]) => void;
  onProficiency: (pick: string) => Promise<void>;
  onLanguage: (pick: InventoryEntry["languagePick"]) => void;
}) {
  const { abilities, proficiency, language } = item.offers;
  const picked = entry.abilityPicks ?? [];
  return (
    <>
      {abilities && (
        <MultiSelect
          label={`Raises, ${item.name}`}
          noun="scores"
          inForm
          options={abilities.from.map((ability) => ({
            value: ability,
            label: ABILITY_LABEL[ability],
          }))}
          selected={picked}
          onChange={(next) => {
            if (!busy) onAbilities(next.slice(-abilities.count) as Ability[]);
          }}
        />
      )}
      {proficiency && (
        <Field
          mode="edit"
          label={`Proficiency, ${item.name}`}
          labelHidden
          placeholder="Proficiency"
          inputClassName="w-32"
          current={entry.proficiencyPick ?? ""}
          format={String}
          parse={String}
          schema={proficiencySchema}
          onSave={onProficiency}
        />
      )}
      {language &&
        (entry.languagePick ? (
          <RemovableChipList
            items={[{ key: refKey(entry.languagePick), label: entry.languagePick.name }]}
            onRemove={() => {
              if (!busy) onLanguage(undefined);
            }}
          />
        ) : (
          <CatalogPicker
            label={`Language, ${item.name}`}
            edition={edition}
            type="language"
            placeholder="Language"
            onPick={(ref) => {
              if (!busy && "source" in ref) onLanguage({ name: ref.name, source: ref.source });
            }}
          />
        ))}
    </>
  );
}
