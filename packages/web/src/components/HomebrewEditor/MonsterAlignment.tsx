import { useState } from "react";
import { InputField } from "../InputField.tsx";
import { type HomebrewFormProps, withField } from "./homebrewEntry.ts";
import { TEXT, WHOLE } from "./homebrewGrid.ts";
import { ROW_BUTTON } from "./homebrewRows.ts";
import { MonsterAlignmentRow } from "./MonsterAlignmentRow.tsx";
import {
  ALIGNMENT_IN_WORDS,
  type AlignmentRow,
  alignmentIsEditable,
  alignmentLabel,
  alignmentRows,
  MONSTER_ALIGNMENTS,
  prefixText,
  withAlignmentRows,
  withPrefix,
} from "./monsterShapes.ts";

const BLANK: AlignmentRow = { note: "", stored: undefined };

/**
 * A homebrew monster's alignment as rows, one per alignment it may have, each with its chance
 * and note or stated in words, and the prefix written before them: `typically`.
 */
export function MonsterAlignment({ entry, onChange, errorFor }: HomebrewFormProps) {
  const editable = alignmentIsEditable(entry.alignment);
  const [rows, setRows] = useState(() => {
    const stated = alignmentRows(entry.alignment);
    return stated.length > 0 ? stated : [BLANK];
  });
  const [prefix, setPrefix] = useState(() => prefixText(entry.alignmentPrefix));
  const write = (next: AlignmentRow[]) => {
    setRows(next);
    onChange(withField(entry, "alignment", withAlignmentRows(next)));
  };
  const replace = (index: number, change: Partial<AlignmentRow>) =>
    write(rows.map((row, at) => (at === index ? { ...row, ...change } : row)));
  const offered = [
    ...MONSTER_ALIGNMENTS,
    ...rows.flatMap(({ letters }) => (letters?.length ? [letters] : [])),
  ];
  const byLabel = new Map<string, string[]>();
  for (const letters of offered) {
    const label = alignmentLabel(letters);
    if (!byLabel.has(label)) byLabel.set(label, letters);
  }
  const options = [
    { value: "", label: "None" },
    ...[...byLabel.keys()].map((label) => ({ value: label, label })),
    { value: ALIGNMENT_IN_WORDS, label: ALIGNMENT_IN_WORDS },
  ];
  const pick = (index: number, row: AlignmentRow, next: string) => {
    if (next === ALIGNMENT_IN_WORDS) {
      replace(index, { letters: undefined, special: row.special ?? "" });
    } else if (row.special !== undefined || !row.letters || alignmentLabel(row.letters) !== next) {
      replace(index, { letters: byLabel.get(next), special: undefined });
    }
  };
  return (
    <>
      {editable ? (
        rows.map((row, index) => (
          <MonsterAlignmentRow
            // biome-ignore lint/suspicious/noArrayIndexKey: a row has no id, and the list only grows or shrinks at a row the user picked.
            key={index}
            index={index}
            row={row}
            options={options}
            error={index === 0 ? errorFor("alignment") : undefined}
            onPick={(next) => pick(index, row, next)}
            onChange={(change) => replace(index, change)}
            onRemove={() => write(rows.filter((_, at) => at !== index))}
          />
        ))
      ) : (
        <p className={`${WHOLE} text-muted text-row`}>
          The alignment is stated in a shape the form cannot show. Edit it in JSON.
        </p>
      )}
      {editable && (
        <div className={WHOLE}>
          <button type="button" onClick={() => write([...rows, BLANK])} className={ROW_BUTTON}>
            Add an alignment
          </button>
        </div>
      )}
      <div className={TEXT}>
        <InputField
          label="Alignment prefix"
          placeholder="typically"
          value={prefix}
          onChange={(event) => {
            setPrefix(event.target.value);
            onChange(withField(entry, "alignmentPrefix", withPrefix(event.target.value)));
          }}
        />
      </div>
    </>
  );
}
