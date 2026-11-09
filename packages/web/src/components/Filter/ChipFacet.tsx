import { EmptyNote } from "../EmptyNote.tsx";
import { FormField } from "../FormField.tsx";
import { RemovableChipList } from "../RemovableChipList.tsx";
import { Select } from "../Select.tsx";

const ADD = "";

/**
 * A facet picking any of a set: the picks as removable chips, "Showing all" while there are
 * none, and a select adding one of the options not yet picked. A row matches the facet
 * where it holds any pick.
 */
export function ChipFacet({
  label,
  options,
  picked,
  onChange,
}: {
  label: string;
  options: readonly string[];
  picked: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const offered = options.filter((option) => !picked.includes(option));
  return (
    <div className="flex flex-col gap-1">
      <span className="font-semibold text-label text-muted uppercase tracking-label">{label}</span>
      {picked.length === 0 ? (
        <EmptyNote>Showing all</EmptyNote>
      ) : (
        <RemovableChipList
          items={picked.map((pick) => ({ key: pick, label: pick }))}
          onRemove={(key) => onChange(picked.filter((pick) => pick !== key))}
        />
      )}
      {offered.length > 0 && (
        <FormField label={`Add ${label.toLowerCase()}`} labelHidden>
          {(control) => (
            <Select
              {...control}
              options={[
                { value: ADD, label: `Add ${label.toLowerCase()}…` },
                ...offered.map((option) => ({ value: option, label: option })),
              ]}
              value={ADD}
              onChange={(next) => onChange([...picked, next])}
            />
          )}
        </FormField>
      )}
    </div>
  );
}
