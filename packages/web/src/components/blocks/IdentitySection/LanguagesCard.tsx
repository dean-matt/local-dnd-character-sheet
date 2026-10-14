import type { SearchHit } from "@dnd/catalog";
import { type CharacterRecord, refKey } from "@dnd/character";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { Card } from "../../Card.tsx";
import { CatalogPicker } from "../../CatalogPicker/CatalogPicker.tsx";
import { RemovableChipList } from "../../RemovableChipList.tsx";

/** The languages known, each a catalog reference added through the picker and removed with ×. */
export function LanguagesCard({ character }: { character: CharacterRecord }) {
  const { languages } = character.definition.proficiencies;
  const write = useHeldSave(character.id, "Languages");
  const known = new Set(languages.map(refKey));
  const unavailable = (hit: SearchHit) => {
    if (!("source" in hit)) return "Not a catalog language";
    return known.has(refKey(hit)) ? "Already known" : undefined;
  };
  const edit = (key: string, change: (list: typeof languages) => typeof languages) =>
    write(key, (latest) => ({
      ...latest,
      proficiencies: {
        ...latest.proficiencies,
        languages: change(latest.proficiencies.languages),
      },
    }));

  return (
    <Card title="Languages">
      <div className="flex flex-col gap-2">
        <RemovableChipList
          items={languages.map((ref) => ({ key: refKey(ref), label: ref.name }))}
          onRemove={(key) => edit(key, (list) => list.filter((ref) => refKey(ref) !== key))}
          empty="No languages."
        />
        <CatalogPicker
          label="Add a language"
          edition={character.definition.edition}
          type="language"
          unavailableReason={unavailable}
          onPick={(ref) => {
            if (!("name" in ref)) return;
            const language = { name: ref.name, source: ref.source };
            edit(refKey(language), (list) =>
              list.some((each) => refKey(each) === refKey(language)) ? list : [...list, language],
            );
          }}
        />
      </div>
    </Card>
  );
}
