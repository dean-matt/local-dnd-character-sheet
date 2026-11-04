import type { ReactNode } from "react";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { Select } from "../Select.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { typedInteger } from "./homebrewEntry.ts";
import { WHOLE } from "./homebrewGrid.ts";
import { ROW } from "./homebrewRows.ts";
import { ALIGNMENT_IN_WORDS, type AlignmentRow, alignmentLabel } from "./monsterShapes.ts";

const percent = (value: number | undefined) =>
  value === undefined ? undefined : Math.min(100, Math.max(0, value));

interface MonsterAlignmentRowProps {
  index: number;
  row: AlignmentRow;
  options: { value: string; label: string }[];
  error: ReactNode;
  onPick: (label: string) => void;
  onChange: (change: Partial<AlignmentRow>) => void;
  onRemove: () => void;
}

/** One alignment: its pick, then its chance and note, or its words where it is prose. */
export function MonsterAlignmentRow({
  index,
  row,
  options,
  error,
  onPick,
  onChange,
  onRemove,
}: MonsterAlignmentRowProps) {
  const label = index === 0 ? "Alignment" : `Alignment ${index + 1}`;
  const value =
    row.special !== undefined ? ALIGNMENT_IN_WORDS : row.letters ? alignmentLabel(row.letters) : "";
  return (
    <div className={`${WHOLE} ${ROW}`}>
      <FormField label={label} error={error}>
        {(control) => <Select {...control} options={options} value={value} onChange={onPick} />}
      </FormField>
      {row.special !== undefined ? (
        <InputField
          label={`${label} in words`}
          placeholder="lawful grumpy"
          value={row.special}
          onChange={(event) => onChange({ special: event.target.value })}
        />
      ) : (
        <>
          <InputField
            label={`${label} chance (%)`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={row.chance ?? ""}
            onChange={(event) => onChange({ chance: percent(typedInteger(event.target.value)) })}
          />
          <InputField
            label={`${label} note`}
            value={row.note}
            onChange={(event) => onChange({ note: event.target.value })}
          />
        </>
      )}
      <HomebrewRowRemove name={`alignment ${index + 1}`} onRemove={onRemove} />
    </div>
  );
}
