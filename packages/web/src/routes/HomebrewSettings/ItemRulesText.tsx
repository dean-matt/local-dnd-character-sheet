import { HomebrewRulesText } from "./HomebrewRulesText.tsx";
import { entriesOf, type HomebrewFormProps, paragraphsOf, withField } from "./homebrewEntry.ts";

/** A homebrew item's rules text. */
export function ItemRulesText({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));

  return (
    <HomebrewRulesText
      label="Rules text"
      text={paragraphsOf(entry.entries)}
      onText={(next) => set("entries", entriesOf(next))}
      error={errorFor("entries")}
    />
  );
}
