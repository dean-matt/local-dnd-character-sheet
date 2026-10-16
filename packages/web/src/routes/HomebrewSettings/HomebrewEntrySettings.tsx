import type { CharacterRecord } from "@dnd/character";
import { FormField } from "../../components/FormField.tsx";
import { Select } from "../../components/Select.tsx";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";
import { FORM_GRID, SHORT } from "./homebrewGrid.ts";
import type { HomebrewStarters } from "./homebrewStarters.ts";

type Edition = CharacterRecord["edition"];
type Starter = HomebrewStarters[number];

const EDITIONS = Object.entries(EDITION_LABELS).map(([value, label]) => ({ value, label }));

export interface HomebrewEntrySettingsProps {
  edition: Edition;
  onEdition: (next: Edition) => void;
  /** The examples a new entry may start from; offered only where there are several. */
  starters: readonly Starter[];
  starter: string;
  onStarter: (picked: Starter) => void;
  /** Which of the two to show: step by step sets the edition in Basics and the example above it. */
  parts?: readonly ("rules" | "starter")[];
  /** Set in a row beside other controls, such as the editor's tabs, rather than on the form's grid. */
  inline?: boolean;
}

/**
 * The entry's edition, and for a new entry the example it starts from where a kind has several;
 * nothing where `parts` leaves neither to show.
 */
export function HomebrewEntrySettings({
  edition,
  onEdition,
  starters,
  starter,
  onStarter,
  parts = ["rules", "starter"],
  inline = false,
}: HomebrewEntrySettingsProps) {
  const rules = parts.includes("rules");
  const starting = parts.includes("starter") && starters.length > 1;
  if (!rules && !starting) return null;
  return (
    <div className={inline ? "flex flex-wrap gap-3 *:w-44" : FORM_GRID}>
      {rules && (
        <div className={SHORT}>
          <FormField label="Rules">
            {(control) => (
              <Select
                {...control}
                options={EDITIONS}
                value={edition}
                onChange={(next) => onEdition(next as Edition)}
              />
            )}
          </FormField>
        </div>
      )}
      {starting && (
        <div className={SHORT}>
          <FormField label="Start from">
            {(control) => (
              <Select
                {...control}
                options={starters.map(({ label }) => ({ value: label, label }))}
                value={starter}
                onChange={(next) => {
                  const picked = starters.find(({ label }) => label === next);
                  if (picked) onStarter(picked);
                }}
              />
            )}
          </FormField>
        </div>
      )}
    </div>
  );
}
