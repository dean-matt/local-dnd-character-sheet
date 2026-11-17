import { netRollEffect, type RollEffectEntry, type RollRecord } from "@dnd/character";
import { type ComponentProps, type ReactNode, useContext, useId, useState } from "react";
import { useCharacterState } from "../hooks/useCharacterState.ts";
import { useExhaustionPenalty } from "../hooks/useExhaustionPenalty.ts";
import { useReplaceCharacterState } from "../hooks/useReplaceCharacterState.ts";
import { parseExtraDie } from "../lib/extraDie.ts";
import { RollPenaltyChip } from "./blocks/RollPenaltyChip.tsx";
import { ExtraDieInput } from "./ExtraDieInput.tsx";
import { RollBonusButton } from "./RollBonusButton.tsx";
import { RollingFor } from "./rollerContext.ts";

type Mode = NonNullable<ComponentProps<typeof RollBonusButton>["mode"]>;

const MODES: readonly { value: Mode; text: string; label: string }[] = [
  { value: "normal", text: "Normal", label: "Normal" },
  { value: "advantage", text: "Adv", label: "Advantage" },
  { value: "disadvantage", text: "Dis", label: "Disadvantage" },
];

/** The net of the effects that hold without a condition; a conditional one is the table's to judge. */
function offered(effects: readonly RollEffectEntry[]): Mode {
  const net = netRollEffect(effects.filter(({ condition }) => condition === undefined));
  return net && net.mode !== "cancel" ? net.mode : "normal";
}

function penalised<R extends { bonus: number; terms?: RollRecord["terms"] }>(
  roll: R,
  penalty: { source: string; value: number } | undefined,
): R {
  if (!penalty) return roll;
  const terms = roll.terms ?? [{ source: "Bonus", value: roll.bonus }];
  return { ...roll, bonus: roll.bonus + penalty.value, terms: [...terms, penalty] };
}

/**
 * A roll button with the mode it rolls in: the net of the advantage and disadvantage on it to
 * start, changed by the player, and a die the player names to add or subtract, such as +1d4 for
 * Bless or -1d4 for Bane.
 * A held Bardic Inspiration die is offered as a checkbox, unticked again when the held die
 * changes. A logged roll that adds it clears it in one state write.
 * The sources of every effect, a conditional one included, are spoken with the control.
 * A 2024 character's exhaustion takes its penalty off the bonus and shows as a chip.
 * `children` sit between the mode and the button.
 */
export function ModeRoll({
  effects = [],
  modeLabel,
  children,
  ...roll
}: Omit<ComponentProps<typeof RollBonusButton>, "mode"> & {
  effects?: readonly RollEffectEntry[];
  /** What the mode control names, where the roll's label changes under it. */
  modeLabel?: string;
  children?: ReactNode;
}) {
  const characterId = useContext(RollingFor);
  const penalty = useExhaustionPenalty(characterId ?? "");
  const sources = useId();
  const extraError = useId();
  const start = offered(effects);
  const [extra, setExtra] = useState("");
  const held = useCharacterState(characterId ?? "").data?.state.bardicInspiration ?? null;
  const replace = useReplaceCharacterState(characterId ?? "");
  const [inspired, setInspired] = useState(false);
  const [seen, setSeen] = useState(held);
  if (seen !== held) {
    setSeen(held);
    setInspired(false);
  }
  const inspiration = inspired && held !== null ? held : undefined;
  const [chosen, setChosen] = useState<{ start: Mode; mode: Mode }>({ start, mode: start });
  const mode = chosen.start === start ? chosen.mode : start;
  if (characterId === null) return null;
  const names = effects.map(
    ({ source, mode: effect, condition }) =>
      `${source}: ${effect}${condition ? ` ${condition}` : ""}`,
  );
  return (
    <span className="flex items-center gap-0.5">
      <RollPenaltyChip roll={roll.label} penalty={penalty} />
      <select
        aria-label={`${modeLabel ?? roll.label} mode`}
        aria-describedby={names.length > 0 ? sources : undefined}
        value={mode}
        onChange={(event) => setChosen({ start, mode: event.target.value as Mode })}
        className="min-h-6 min-w-0 rounded-control border border-border bg-surface text-label"
      >
        {MODES.map(({ value, text, label }) => (
          <option key={value} value={value} aria-label={label}>
            {text}
          </option>
        ))}
      </select>
      <span id={sources} className="sr-only">
        {names.join("; ")}
      </span>
      {children}
      <ExtraDieInput
        label={modeLabel ?? roll.label}
        value={extra}
        onChange={setExtra}
        error={parseExtraDie(extra).error}
        describedBy={extraError}
      />
      <span id={extraError} className="sr-only">
        {parseExtraDie(extra).error}
      </span>
      {held !== null && (
        <label className="flex items-center gap-1 text-label">
          <input
            type="checkbox"
            checked={inspired}
            onChange={(event) => setInspired(event.target.checked)}
          />
          Bardic Inspiration d{held}
        </label>
      )}
      <RollBonusButton
        {...penalised(roll, penalty)}
        mode={mode}
        extra={extra}
        inspiration={inspiration}
        onRolled={(hit, logged) => {
          roll.onRolled?.(hit, logged);
          if (inspiration === undefined || !logged) return;
          setInspired(false);
          replace.mutate((latest) => ({ ...latest, bardicInspiration: null }));
        }}
      />
    </span>
  );
}
