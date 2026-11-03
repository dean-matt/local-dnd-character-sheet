import { type HomebrewFormProps, withField } from "./homebrewEntry.ts";
import { FORM_GRID, TEXT } from "./homebrewGrid.ts";
import { MonsterTextRows } from "./MonsterTextRows.tsx";
import { stringsIn, withStrings } from "./monsterShapes.ts";

/**
 * A homebrew monster's senses and languages, each a line of text such as `darkvision 60 ft.`.
 * The passive Perception score is its own field and stays as written.
 */
export function MonsterSenses({ entry, onChange, errorFor }: HomebrewFormProps) {
  const rows = (key: "senses" | "languages", noun: string, legend: string) => (
    <div className={TEXT}>
      <MonsterTextRows
        noun={noun}
        legend={legend}
        initial={stringsIn(entry[key])}
        onChange={(next) => onChange(withField(entry, key, withStrings(entry[key], next)))}
        error={errorFor(key)}
      />
    </div>
  );
  return (
    <div className={FORM_GRID}>
      {rows("senses", "sense", "Senses")}
      {rows("languages", "language", "Languages")}
    </div>
  );
}
