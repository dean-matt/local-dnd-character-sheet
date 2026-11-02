import { ALIGNMENT_WORDS } from "../../lib/homebrewOptionFacts.ts";
import { InputField } from "../InputField.tsx";
import { MultiSelect } from "../MultiSelect.tsx";
import { type HomebrewFormProps, listAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, TEXT } from "./homebrewGrid.ts";

const OPTIONS = Object.entries(ALIGNMENT_WORDS).map(([value, label]) => ({ value, label }));

const asDomains = (text: string) => {
  const domains = text
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean);
  return domains.length > 0 ? domains : undefined;
};

/**
 * A homebrew deity's alignment, as upstream's letters in the order they are picked, and its
 * domains, typed as a comma-separated list.
 */
export function DeityStanding({ entry, onChange, errorFor }: HomebrewFormProps) {
  const letters = listAt(entry, "alignment").filter((each) => typeof each === "string");
  const domains = listAt(entry, "domains").filter((each) => typeof each === "string");
  return (
    <div className={FORM_GRID}>
      <div className={TEXT}>
        <MultiSelect
          inForm
          label="Alignment"
          noun="alignments"
          options={OPTIONS}
          selected={letters}
          onChange={(chosen) =>
            onChange(withField(entry, "alignment", chosen.length > 0 ? chosen : undefined))
          }
        />
      </div>
      <div className={TEXT}>
        <InputField
          label="Domains"
          placeholder="Life, Light"
          defaultValue={domains.join(", ")}
          onChange={(event) => onChange(withField(entry, "domains", asDomains(event.target.value)))}
          error={errorFor("domains")}
        />
      </div>
    </div>
  );
}
