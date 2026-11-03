import { homebrewSkillRecordSchema } from "@dnd/catalog";
import type { CharacterRecord, EntryRef } from "@dnd/character";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { useHomebrew } from "../../hooks/useHomebrew.ts";
import { searchHitRef } from "../../lib/searchHitKey.ts";
import { FormField } from "../FormField.tsx";
import { Select } from "../Select.tsx";

export interface SkillCopyChoiceProps {
  label: string;
  edition: CharacterRecord["edition"];
  onPick: (ref: EntryRef, name: string) => void;
}

/** Every catalog and homebrew skill of `edition`; `/search` holds no homebrew skill, so both are read. */
export function SkillCopyChoice({ label, edition, onPick }: SkillCopyChoiceProps) {
  const catalog = useCatalogSearch({
    edition,
    type: "skill",
    query: "",
    listAll: true,
    limit: 200,
  });
  const homebrew = useHomebrew("skills", homebrewSkillRecordSchema).list.data ?? [];
  const choices = [
    ...(catalog.data?.items ?? []).flatMap((hit) =>
      "id" in hit
        ? []
        : [{ ref: searchHitRef(hit), name: hit.name, label: `${hit.name} (${hit.source})` }],
    ),
    ...homebrew
      .filter((row) => row.edition === edition)
      .map((row) => ({
        ref: { homebrewId: row.id },
        name: row.name,
        label: `${row.name} (Homebrew)`,
      })),
  ];
  return (
    <FormField label={label}>
      {(control) => (
        <Select
          {...control}
          options={[
            { value: "", label: "Choose a skill" },
            ...choices.map(({ ref, label: shown }) => ({
              value: JSON.stringify(ref),
              label: shown,
            })),
          ]}
          value=""
          onChange={(value) => {
            const choice = choices.find(({ ref }) => JSON.stringify(ref) === value);
            if (choice) onPick(choice.ref, choice.name);
          }}
        />
      )}
    </FormField>
  );
}
