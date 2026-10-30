import { InputField } from "../InputField.tsx";
import { HomebrewCheckbox } from "./HomebrewCheckbox.tsx";
import { type HomebrewFormProps, typedInteger, withField } from "./homebrewEntry.ts";
import { FORM_GRID, SHORT, WHOLE } from "./homebrewGrid.ts";
import { readSpeed, SPEED_MODES, type SpeedMode, writeSpeed } from "./raceSpeedShapes.ts";

const LABELS: Record<SpeedMode, string> = {
  walk: "Walking",
  burrow: "Burrowing",
  climb: "Climbing",
  fly: "Flying",
  swim: "Swimming",
};

/**
 * A homebrew race's speed in feet for each mode it has. Every mode but walking can instead
 * equal the walking speed, as upstream writes `true`.
 */
export function RaceSpeed({ entry, onChange, errorFor }: HomebrewFormProps) {
  const speeds = readSpeed(entry.speed);
  const error = errorFor("speed");
  const set = (mode: SpeedMode, value: number | true | undefined) =>
    onChange(withField(entry, "speed", writeSpeed(entry.speed, mode, value)));
  return (
    <div className={FORM_GRID}>
      {SPEED_MODES.map((mode) => {
        const feet = speeds[mode];
        return (
          <div key={mode} className={`${SHORT} flex flex-col gap-1`}>
            <InputField
              label={`${LABELS[mode]} (ft.)`}
              type="number"
              min={0}
              step={5}
              disabled={feet === true}
              value={typeof feet === "number" ? feet : ""}
              onChange={(event) => set(mode, typedInteger(event.target.value))}
            />
            {mode !== "walk" && (
              <HomebrewCheckbox
                label={`${LABELS[mode]} equals walking`}
                checked={feet === true}
                onChange={(checked) => set(mode, checked ? true : undefined)}
              />
            )}
          </div>
        );
      })}
      {error && (
        <p role="alert" className={`${WHOLE} text-error text-row`}>
          {error}
        </p>
      )}
    </div>
  );
}
