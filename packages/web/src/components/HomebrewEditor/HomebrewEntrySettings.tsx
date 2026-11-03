import type { CharacterRecord } from "@dnd/character";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";
import type { HomebrewStarters } from "../../lib/homebrewStarters.ts";
import { FormField } from "../FormField.tsx";
import { Select } from "../Select.tsx";
import { CopyFromField } from "./CopyFromField.tsx";
import type { HomebrewEntry } from "./homebrewDraft.ts";

type Edition = CharacterRecord["edition"];
type Starter = HomebrewStarters[number];

const EDITIONS = Object.entries(EDITION_LABELS).map(([value, label]) => ({ value, label }));

export interface HomebrewEntrySettingsProps {
  collection: HomebrewCollection;
  /** True for a new entry, the only one that starts from an example or a copy. */
  fresh: boolean;
  /** The kind as `/search` names it, where a new entry can copy an existing one. */
  copyType: string | undefined;
  onCopy: (entry: HomebrewEntry) => void;
  /** Absent for a kind with no edition, which shows no Rules control. */
  edition: Edition | undefined;
  onEdition: (next: Edition) => void;
  /** The examples a new entry may start from; offered only where there are several. */
  starters: readonly Starter[];
  starter: string;
  onStarter: (picked: Starter) => void;
}

/**
 * For a new entry the entry it copies and the example it starts from, where a kind has
 * them, then the entry's edition, in one row the editor sets at the end of its tabs.
 */
export function HomebrewEntrySettings({
  collection,
  fresh,
  copyType,
  onCopy,
  edition,
  onEdition,
  starters,
  starter,
  onStarter,
}: HomebrewEntrySettingsProps) {
  const copies = fresh && copyType !== undefined && edition !== undefined;
  const offered = fresh ? starters : [];
  if (!copies && edition === undefined && offered.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-3 *:w-44">
      {copies && (
        <CopyFromField collection={collection} type={copyType} edition={edition} onCopy={onCopy} />
      )}
      {offered.length > 1 && (
        <FormField label="Start from">
          {(control) => (
            <Select
              {...control}
              options={offered.map(({ label }) => ({ value: label, label }))}
              value={starter}
              onChange={(next) => {
                const picked = offered.find(({ label }) => label === next);
                if (picked) onStarter(picked);
              }}
            />
          )}
        </FormField>
      )}
      {edition !== undefined && (
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
      )}
    </div>
  );
}
