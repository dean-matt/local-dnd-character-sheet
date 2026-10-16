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
}

/** The entry's edition, and for a new entry the example it starts from where a kind has several. */
export function HomebrewEntrySettings({
  edition,
  onEdition,
  starters,
  starter,
  onStarter,
}: HomebrewEntrySettingsProps) {
  return (
    <div className={FORM_GRID}>
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
      {starters.length > 1 && (
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
