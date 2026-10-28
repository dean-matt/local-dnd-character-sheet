import type { CharacterRecord } from "@dnd/character";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";
import type { HomebrewStarters } from "../../lib/homebrewStarters.ts";
import { FormField } from "../FormField.tsx";
import { Select } from "../Select.tsx";

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

/**
 * For a new entry the example it starts from, where a kind has several, then the entry's
 * edition, in one row the editor sets at the end of its tabs.
 */
export function HomebrewEntrySettings({
  edition,
  onEdition,
  starters,
  starter,
  onStarter,
}: HomebrewEntrySettingsProps) {
  return (
    <div className="flex flex-wrap gap-3 *:w-44">
      {starters.length > 1 && (
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
      )}
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
  );
}
