import {
  type CharacterDefinition,
  type CharacterDerived,
  characterDerivedSchema,
  type Derived,
  derivedValue,
  encumberedSpeed,
} from "@dnd/character";
import { useContext } from "react";
import { capitalize } from "../../../lib/capitalize.ts";
import { Field } from "../../Field/Field.tsx";
import { OverrideMark } from "../../OverrideMark.tsx";
import { SaveOverride } from "../../overrideContext.ts";
import { Popover } from "../../Popover.tsx";
import { TermList } from "../../TermList.tsx";

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
 * for every mode, so a mode counts as overridden only where it differs from its computed
 * value; typing that value back clears the mode's key rather than pinning it unmarked. A
 * mode a whole-speed override leaves out reads as its computed value.
 */
function modeOf(speed: Derived<Speed>, mode: Mode): Derived<number | undefined> {
  const computed = speed.computed[mode];
  const manual = speed.manual?.[mode];
  return { computed, manual: manual === undefined || manual === computed ? null : manual };
}

/**
 * The walking speed on the Combat tile, any other mode beneath it, and a breakdown that
 * overrides each mode under its own key, such as `speed.fly`. A mode no race grants, such
 * as burrowing, takes an override too.
 *
 * The speeds shown are what the carried load leaves, which the encumbrance house rule
 * reduces after any override, and its breakdown names the rule. An override is marked
 * against the computed speed under the same load. Each override field edits the speed
 * before the load, the value the definition stores.
 */
export function SpeedValue({
  definition,
  derived,
}: {
  definition: CharacterDefinition;
  derived: CharacterDerived;
}) {
  const save = useContext(SaveOverride);
  const speed = derived.speed;
  const loaded = encumberedSpeed(definition, derived, derived.carriedWeight);
  const loadedComputed = encumberedSpeed(
    definition,
    { ...derived, speed: { ...speed, manual: null } },
    derived.carriedWeight,
  ).speed;
  const shown = (mode: Mode): Derived<number | undefined> => ({
    computed: loadedComputed[mode],
    manual: modeOf(speed, mode).manual === null ? null : loaded.speed[mode],
  });
  const walk = shown("walk");
  const trigger = (
    <Field mode="read" label="" labelHidden value={walk} format={(value) => String(value)} />
  );
  const overridden = MODES.some((mode) => modeOf(speed, mode).manual !== null);
  const reduction = loaded.reductionBreakdown.terms.map(({ label, value }) => ({
    label,
    value: -value,
  }));
  const terms = overridden ? reduction : [...(speed.terms ?? []), ...reduction];
  const extraModes = MODES.filter(
    (mode) => mode !== "walk" && derivedValue(modeOf(speed, mode)) !== undefined,
  );
  return (
    <>
      {terms.length === 0 && !overridden && save === null ? (
        trigger
      ) : (
        <Popover
          trigger={trigger}
          triggerLabel={`Speed ${derivedValue(walk)}${
            walk.manual === null ? "" : `, overridden from ${walk.computed}`
          }`}
          label="Speed breakdown"
        >
          <div className="flex flex-col gap-1.5">
            {overridden && (
              <p>
                Overridden from {speedText(loadedComputed)}.
                {save !== null && " Clear a mode to return it."}
              </p>
            )}
            {terms.length > 0 && <TermList terms={terms} />}
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
                      save(`speed.${mode}`, next === speed.computed[mode] ? null : (next ?? null))
                    }
                  />
                </div>
              ))}
          </div>
        </Popover>
      )}
      {extraModes.map((mode) => {
        const value = shown(mode);
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
