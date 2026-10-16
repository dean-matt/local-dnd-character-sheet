import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { SCHOOLS } from "../../lib/spellSchool.ts";
import { type HomebrewFormProps, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, NAME, SHORT } from "./homebrewGrid.ts";
import { SPELL_LEVELS } from "./homebrewVocabulary.ts";
import { withUpcastNameFor } from "./spellUpcast.ts";

const SCHOOL_OPTIONS = Object.entries(SCHOOLS).map(([value, label]) => ({ value, label }));

/** A homebrew spell's first step: its name, level and school. */
export function SpellBasics({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));

  return (
    <div className={FORM_GRID}>
      <div className={NAME}>
        <InputField
          label="Name"
          value={textAt(entry, "name")}
          onChange={(event) => set("name", event.target.value)}
          error={errorFor("name")}
        />
      </div>
      <div className={SHORT}>
        <FormField label="Level" error={errorFor("level")}>
          {(control) => (
            <Select
              {...control}
              options={SPELL_LEVELS}
              value={String(entry.level ?? "")}
              onChange={(next) =>
                onChange(withUpcastNameFor(withField(entry, "level", Number(next)), edition))
              }
            />
          )}
        </FormField>
      </div>
      <div className={SHORT}>
        <FormField label="School" error={errorFor("school")}>
          {(control) => (
            <Select
              {...control}
              options={SCHOOL_OPTIONS}
              value={textAt(entry, "school")}
              onChange={(next) => set("school", next)}
            />
          )}
        </FormField>
      </div>
    </div>
  );
}
