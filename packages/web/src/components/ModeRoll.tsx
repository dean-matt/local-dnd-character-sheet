import { netRollEffect, type RollEffectEntry, type RollOption } from "@dnd/character";
import { type ComponentProps, type ReactNode, useContext, useId, useState } from "react";
import { useCharacterState } from "../hooks/useCharacterState.ts";
import { useReplaceCharacterState } from "../hooks/useReplaceCharacterState.ts";
import { parseExtraDie } from "../lib/extraDie.ts";
import { ExtraDieInput } from "./ExtraDieInput.tsx";
import { RollBonusButton } from "./RollBonusButton.tsx";
import { RollingFor } from "./rollerContext.ts";

type Mode = NonNullable<ComponentProps<typeof RollBonusButton>["mode"]>;

const MODES: readonly { value: Mode; text: string; label: string }[] = [
  { value: "normal", text: "Normal", label: "Normal" },
  { value: "advantage", text: "Adv", label: "Advantage" },
  { value: "disadvantage", text: "Dis", label: "Disadvantage" },
];

/** The net of the effects that hold. */
function offered(effects: readonly RollEffectEntry[]): Mode {
  const net = netRollEffect(effects);
  return net && net.mode !== "cancel" ? net.mode : "normal";
}

/** What a conditional entry does to the roll, as its checkbox reads. */
const doing = (entry: RollEffectEntry | RollOption) =>
  "mode" in entry ? (entry.mode === "advantage" ? "Adv" : "Dis") : `+${entry.value}`;

const optionKey = (entry: RollEffectEntry | RollOption) =>
  `${entry.source}|${doing(entry)}|${entry.condition}`;

/**
 * A roll button with the mode it rolls in: the net of the advantage and disadvantage on it to
 * start, changed by the player, and a die the player names to add or subtract, such as +1d4 for
 * Bless or -1d4 for Bane. An effect with a condition, and each of `options`, is a checkbox the
 * player ticks where the condition holds: a ticked effect joins the net, and a ticked option
 * adds its bonus as a term. A logged roll unticks them, since a condition holds roll by roll.
 * A held Bardic Inspiration die is offered as a checkbox, unticked again when the held die
 * changes. A logged roll that adds it clears it in one state write.
 * The sources of every effect, a conditional one included, are spoken with the control.
 * `children` sit between the mode and the button.
 */
export function ModeRoll({
  effects = [],
  options = [],
  modeLabel,
  children,
  ...roll
}: Omit<ComponentProps<typeof RollBonusButton>, "mode"> & {
  effects?: readonly RollEffectEntry[];
  options?: readonly RollOption[];
  /** What the mode control names, where the roll's label changes under it. */
  modeLabel?: string;
  children?: ReactNode;
}) {
  const characterId = useContext(RollingFor);
  const sources = useId();
  const extraError = useId();
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const conditional = [...effects.filter(({ condition }) => condition !== undefined), ...options];
  const holds = (entry: RollEffectEntry | RollOption) =>
    entry.condition === undefined || ticked.has(optionKey(entry));
  const start = offered(effects.filter(holds));
  const added = options.filter(holds);
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
      {conditional.map((entry) => {
        const key = optionKey(entry);
        return (
          <label key={key} className="flex items-center gap-1 text-label">
            <input
              type="checkbox"
              checked={ticked.has(key)}
              aria-label={`${entry.source}: ${doing(entry)} ${entry.condition}`}
              onChange={(event) => {
                const next = new Set(ticked);
                if (event.target.checked) next.add(key);
                else next.delete(key);
                setTicked(next);
              }}
            />
            <span title={entry.condition}>
              {entry.source} {doing(entry)}
            </span>
          </label>
        );
      })}
      <RollBonusButton
        {...roll}
        bonus={added.reduce((sum, { value }) => sum + value, roll.bonus)}
        terms={
          added.length === 0
            ? roll.terms
            : roll.terms && [
                ...roll.terms,
                ...added.map(({ source, value }) => ({ source, value })),
              ]
        }
        mode={mode}
        extra={extra}
        inspiration={inspiration}
        onRolled={(hit, logged) => {
          roll.onRolled?.(hit, logged);
          if (logged && ticked.size > 0) setTicked(new Set());
          if (inspiration === undefined || !logged) return;
          setInspired(false);
          replace.mutate((latest) => ({ ...latest, bardicInspiration: null }));
        }}
      />
    </span>
  );
}
