import { InputField } from "../InputField.tsx";
import { type HomebrewFormProps, recordAt, typedInteger, withField } from "./homebrewEntry.ts";
import { FORM_GRID, SHORT, TEXT, WHOLE } from "./homebrewGrid.ts";
import {
  armorClassIsProse,
  firstArmorClass,
  MONSTER_SPEED_MODES,
  type MonsterSpeedMode,
  speedFeet,
  withArmorClass,
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
 * A homebrew monster's armor class, hit points and speed. The first armor class and the
 * average hit points are the form's; a list of armor classes, a stated source or hit points
 * written as prose stay as written and are edited in JSON.
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
  const prose = armorClassIsProse(entry.ac) || hp.special !== undefined;
  return (
    <div className={FORM_GRID}>
      <div className={SHORT}>
        <InputField
          label="Armor class"
          type="number"
          min={0}
          step={1}
          disabled={armorClassIsProse(entry.ac)}
          value={firstArmorClass(entry.ac) ?? ""}
          onChange={(event) =>
            set("ac", withArmorClass(entry.ac, typedInteger(event.target.value)))
          }
          error={errorFor("ac")}
        />
      </div>
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
      {errorFor("speed") && (
        <p role="alert" className={`${WHOLE} text-error text-row`}>
          {errorFor("speed")}
        </p>
      )}
      {prose && (
        <p className={`${WHOLE} text-muted text-row`}>
          Part of the armor class or hit points is stated in a way the form cannot show. Edit it in
          JSON.
        </p>
      )}
    </div>
  );
}
