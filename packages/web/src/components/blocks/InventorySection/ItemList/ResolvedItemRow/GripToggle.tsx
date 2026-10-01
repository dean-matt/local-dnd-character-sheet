import type { Attack, Grip } from "../../../../../lib/attack.ts";
import { Popover } from "../../../../Popover.tsx";

const PILL = "relative rounded-pill px-2 py-0.5 font-bold text-chip leading-3 tracking-chip";

const pillState = (pressed: boolean) =>
  pressed ? `${PILL} bg-accent text-white` : `${PILL} bg-transparent text-muted`;

/**
 * The 1h/2h pill a versatile weapon draws. Two-handed opens a popover saying why in place
 * of pressing while a shield is equipped beside the weapon.
 */
export function GripToggle({
  name,
  grip,
  onChange,
  saving,
}: {
  name: string;
  grip: NonNullable<Attack["grip"]>;
  onChange: (grip: Grip) => void;
  saving: boolean;
}) {
  const option = (value: Grip, label: string, spoken: string) => (
    <button
      type="button"
      aria-label={`${label}, ${spoken}`}
      aria-pressed={grip.held === value}
      aria-disabled={saving}
      onClick={() => !saving && grip.held !== value && onChange(value)}
      className={pillState(grip.held === value)}
    >
      {label}
    </button>
  );
  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form fields; this groups two toggle buttons.
    <div
      role="group"
      aria-label={`${name} grip`}
      className="flex gap-0.5 rounded-pill bg-border p-px"
    >
      {option("one-handed", "1h", "one-handed")}
      {grip.twoHandedBlocked ? (
        <Popover
          trigger={<span className={`${pillState(false)} opacity-60`}>2h</span>}
          triggerLabel="2h, two-handed, unavailable"
          label="Two-handed"
        >
          Unavailable while this weapon and a shield are both equipped.
        </Popover>
      ) : (
        option("two-handed", "2h", "two-handed")
      )}
    </div>
  );
}
