import { SENSES } from "@dnd/character";
import { type HomebrewFormProps, listAt, numberAt, withField } from "./homebrewEntry.ts";
import { ItemSenseFields } from "./ItemSenseFields.tsx";

/**
 * The senses a homebrew race grants, with the item form's controls. A race states a sense as
 * a field of its own, such as `darkvision: 60`; the controls read those with the `senses`
 * list, and write the list alone once one changes, which counts the same.
 */
export function RaceSenses({ entry, onChange, errorFor }: HomebrewFormProps) {
  const ownFields = SENSES.flatMap((sense) =>
    numberAt(entry[sense]) === undefined ? [] : [{ [sense]: entry[sense] }],
  );
  return (
    <ItemSenseFields
      senses={[...listAt(entry, "senses"), ...ownFields]}
      onChange={(next) => {
        const rest = Object.fromEntries(
          Object.entries(entry).filter(([key]) => !(SENSES as readonly string[]).includes(key)),
        );
        onChange(withField(rest, "senses", next.length > 0 ? next : undefined));
      }}
      error={errorFor("senses")}
    />
  );
}
