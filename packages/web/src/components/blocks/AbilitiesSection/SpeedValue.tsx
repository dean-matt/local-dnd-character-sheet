import {
  type CharacterDerived,
  characterDerivedSchema,
  type Derived,
  derivedValue,
} from "@dnd/character";
import { useContext } from "react";
import { Field } from "../../Field/Field.tsx";
import { OverrideMark } from "../../OverrideMark.tsx";
import { SaveOverride } from "../../overrideContext.ts";
import { Popover } from "../../Popover.tsx";
import { TermList } from "../../TermList.tsx";
import { capitalize } from "../capitalize.ts";

type Speed = CharacterDerived["speed"]["computed"];

const MODES = ["walk", "burrow", "climb", "fly", "swim"] as const;
type Mode = (typeof MODES)[number];

const MODE_SCHEMA = characterDerivedSchema.shape.speed.shape.computed.shape;

const feet = (value: number | undefined) => (value === undefined ? "none" : `${value} ft.`);

const speedText = (speed: Speed) =>
  MODES.flatMap((mode) => {
    const value = speed[mode];
    if (value === undefined) return [];
    return mode === "walk" ? [feet(value)] : [`${mode} ${feet(value)}`];
  }).join(", ");

/**
 * One mode of the speed as a derived number of its own. The block holds one manual object
 * for every mode, so a mode counts as overridden only where it differs from its computed value.
 */
function modeOf(speed: Derived<Speed>, mode: Mode): Derived<number | undefined> {
  const computed = speed.computed[mode];
  const manual = speed.manual?.[mode];
  return { computed, manual: speed.manual === null || manual === computed ? null : manual };
}

/**
 * The walking speed on the Combat tile, any other mode beneath it, and a breakdown that
 * overrides each mode under its own key, such as `speed.fly`. A mode no race grants, such
 * as burrowing, takes an override too.
 */
export function SpeedValue({ speed }: { speed: Derived<Speed> }) {
  const save = useContext(SaveOverride);
  const walk = modeOf(speed, "walk");
  const trigger = (
    <Field mode="read" label="" labelHidden value={walk} format={(value) => String(value)} />
  );
  const terms = speed.terms ?? [];
  const overridden = MODES.some((mode) => modeOf(speed, mode).manual !== null);
  const extraModes = MODES.filter(
    (mode) => mode !== "walk" && derivedValue(speed)[mode] !== undefined,
  );
  return (
    <>
      {terms.length === 0 && !overridden && save === null ? (
        trigger
      ) : (
        <Popover
          trigger={trigger}
          triggerLabel={`Speed ${derivedValue(speed).walk}${
            walk.manual === null ? "" : `, overridden from ${walk.computed}`
          }`}
          label="Speed breakdown"
        >
          <div className="flex flex-col gap-1.5">
            {overridden ? (
              <p>
                Overridden from {speedText(speed.computed)}.
                {save !== null && " Clear a mode to return it."}
              </p>
            ) : (
              terms.length > 0 && <TermList terms={terms} />
            )}
            {save !== null &&
              MODES.map((mode) => (
                <div key={mode} className="flex items-baseline justify-between gap-4">
                  <span aria-hidden="true" className="text-muted">
                    {capitalize(mode)}
                  </span>
                  <Field
                    mode="edit"
                    label={`${capitalize(mode)} speed override`}
                    labelHidden
                    value={modeOf(speed, mode)}
                    format={(value) => (value === undefined ? "" : String(value))}
                    parse={(raw) => (/^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN)}
                    schema={MODE_SCHEMA[mode]}
                    inputClassName="w-16 py-0.5 text-right"
                    onSave={(next: number | undefined | null) =>
                      save(`speed.${mode}`, next ?? null)
                    }
                  />
                </div>
              ))}
          </div>
        </Popover>
      )}
      {extraModes.map((mode) => {
        const value = modeOf(speed, mode);
        return (
          <span key={mode} className="font-normal text-label text-muted">
            {mode} {derivedValue(value)} ft.
            {value.manual !== null && <OverrideMark computed={feet(value.computed)} />}
          </span>
        );
      })}
    </>
  );
}
