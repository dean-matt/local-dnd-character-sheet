import { useState } from "react";
import { InputField } from "../InputField.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { type HomebrewFormProps, recordAt, typedInteger, withField } from "./homebrewEntry.ts";
import { FORM_GRID, SHORT, TEXT, WHOLE } from "./homebrewGrid.ts";
import { ROW, ROW_BUTTON } from "./homebrewRows.ts";
import {
  type ExtraArmorClass,
  extraArmorClasses,
  firstArmorClass,
  firstArmorClassWords,
  MONSTER_SPEED_MODES,
  type MonsterSpeedMode,
  speedFeet,
  withArmorClass,
  withArmorClassWords,
  withExtraArmorClasses,
  withSpeed,
} from "./monsterShapes.ts";

const SPEED_LABELS: Record<MonsterSpeedMode, string> = {
  walk: "Walking",
  burrow: "Burrowing",
  climb: "Climbing",
  fly: "Flying",
  swim: "Swimming",
};

/**
 * A homebrew monster's armor classes, hit points and speed. An armor class is a number with its
 * source, or words; hit points written as prose stay as written and are edited in JSON.
 */
export function MonsterCombat({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const hp = recordAt(entry, "hp");
  const average = typeof hp.average === "number" ? hp.average : "";
  const setHp = (key: string, value: unknown) => {
    const next = Object.fromEntries(
      Object.entries({ ...hp, [key]: value }).filter(([, each]) => each !== undefined),
    );
    set("hp", Object.keys(next).length > 0 ? next : undefined);
  };
  const [extras, setExtras] = useState(() => extraArmorClasses(entry.ac));
  const writeExtras = (next: ExtraArmorClass[]) => {
    setExtras(next);
    set("ac", withExtraArmorClasses(entry.ac, next));
  };
  const replace = (index: number, change: Partial<ExtraArmorClass>) =>
    writeExtras(extras.map((row, at) => (at === index ? { ...row, ...change } : row)));
  const words = firstArmorClassWords(entry.ac);
  return (
    <div className={FORM_GRID}>
      {words !== undefined ? (
        <div className={TEXT}>
          <InputField
            label="Armor class in words"
            placeholder="13 + PB (natural armor)"
            value={words}
            onChange={(event) => set("ac", withArmorClassWords(entry.ac, event.target.value))}
            error={errorFor("ac")}
          />
        </div>
      ) : (
        <div className={SHORT}>
          <InputField
            label="Armor class"
            type="number"
            min={0}
            step={1}
            value={firstArmorClass(entry.ac) ?? ""}
            onChange={(event) =>
              set("ac", withArmorClass(entry.ac, typedInteger(event.target.value)))
            }
            error={errorFor("ac")}
          />
        </div>
      )}
      <div className={SHORT}>
        <InputField
          label="Hit points"
          type="number"
          min={0}
          step={1}
          value={average}
          onChange={(event) => setHp("average", typedInteger(event.target.value))}
          error={errorFor("hp")}
        />
      </div>
      <div className={TEXT}>
        <InputField
          label="Hit dice"
          placeholder="4d8 + 4"
          value={typeof hp.formula === "string" ? hp.formula : ""}
          onChange={(event) => setHp("formula", event.target.value.trim() || undefined)}
        />
      </div>
      {MONSTER_SPEED_MODES.map((mode) => (
        <div key={mode} className={SHORT}>
          <InputField
            label={`${SPEED_LABELS[mode]} (ft.)`}
            type="number"
            min={0}
            step={5}
            value={speedFeet(entry.speed, mode) ?? ""}
            onChange={(event) =>
              set("speed", withSpeed(entry.speed, mode, typedInteger(event.target.value)))
            }
          />
        </div>
      ))}
      {extras.map((row, index) => {
        const label = `Armor class ${index + 2}`;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a row has no id, and the list only grows or shrinks at a row the user picked.
          <div key={index} className={`${WHOLE} ${ROW}`}>
            {row.special !== undefined ? (
              <InputField
                label={`${label} in words`}
                placeholder="13 + PB (natural armor)"
                value={row.special}
                onChange={(event) => replace(index, { special: event.target.value })}
              />
            ) : (
              <>
                <InputField
                  label={label}
                  type="number"
                  min={0}
                  step={1}
                  value={row.ac ?? ""}
                  onChange={(event) => replace(index, { ac: typedInteger(event.target.value) })}
                />
                <InputField
                  label={`${label} source`}
                  placeholder="natural armor"
                  value={row.source}
                  onChange={(event) => replace(index, { source: event.target.value })}
                />
              </>
            )}
            <HomebrewRowRemove
              name={label.toLowerCase()}
              onRemove={() => writeExtras(extras.filter((_, at) => at !== index))}
            />
          </div>
        );
      })}
      <div className={WHOLE}>
        <button
          type="button"
          onClick={() => writeExtras([...extras, { ac: undefined, source: "", stored: undefined }])}
          className={ROW_BUTTON}
        >
          Add an armor class
        </button>
      </div>
      {errorFor("speed") && (
        <p role="alert" className={`${WHOLE} text-error text-row`}>
          {errorFor("speed")}
        </p>
      )}
      {hp.special !== undefined && (
        <p className={`${WHOLE} text-muted text-row`}>
          The hit points are stated in a way the form cannot show. Edit them in JSON.
        </p>
      )}
    </div>
  );
}
