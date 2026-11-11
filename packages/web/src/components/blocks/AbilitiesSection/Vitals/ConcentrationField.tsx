import type { CharacterRecord, Concentration, EntryRef } from "@dnd/character";
import { useEffect, useRef, useState } from "react";
import { useSpellLookup } from "../../../../hooks/useSpellLookup.ts";
import { CatalogPicker } from "../../../CatalogPicker/CatalogPicker.tsx";
import { FormField } from "../../../FormField.tsx";
import { Select } from "../../../Select.tsx";

const BUTTON =
  "h-8 rounded-control border border-border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const CONCENTRATION_FILTER = { concentration: "true" };

const levelName = (level: number) => (level === 0 ? "cantrip" : `level ${level}`);

const noContext = () => ({});

/** A spell cast at its own level or higher; a cantrip has no higher level. */
const levelsFrom = (own: number) =>
  own === 0 ? [0] : Array.from({ length: 10 - own }, (_, at) => own + at);

/**
 * The held concentration with a control that ends it, and a picker over the edition's catalog
 * and homebrew spells that need concentration. A picked spell offers each level from its own
 * up, its own first, and Concentrate sets it, naming the held spell it ends. `onSet` and
 * `onEnd` each make one write, announced with the text given, and resolve whether it landed.
 */
export function ConcentrationField({
  edition,
  held,
  busy,
  onSet,
  onEnd,
}: {
  edition: CharacterRecord["edition"];
  held: Concentration | null;
  busy: boolean;
  onSet: (concentration: Concentration, announced: string) => Promise<boolean>;
  onEnd: (announced: string) => Promise<boolean>;
}) {
  const [picked, setPicked] = useState<{ ref: EntryRef; name: string }>();
  const [level, setLevel] = useState<number>();
  // Where focus goes, once, after a set, a cancel or an end: End concentration after a set,
  // since the picker opens its list on focus and would cover the new held line, else the open
  // pick's Concentrate or the picker. Cleared once moved, so an undo that changes `held` leaves
  // focus where the user put it.
  const [focusNext, setFocusNext] = useState<"end" | "picker">();
  const root = useRef<HTMLDivElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const end = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (picked) confirm.current?.focus();
  }, [picked]);
  useEffect(() => {
    if (focusNext === undefined || (focusNext === "end" && !held)) return;
    const target =
      focusNext === "end"
        ? end.current
        : (confirm.current ?? root.current?.querySelector<HTMLElement>('[role="combobox"]'));
    target?.focus();
    setFocusNext(undefined);
  }, [focusNext, held]);
  const heldLookup = useSpellLookup(held ? [held.spell] : [], noContext);
  const pickedLookup = useSpellLookup(picked ? [picked.ref] : [], noContext);
  const heldLabel =
    (held && ("name" in held.spell ? held.spell.name : heldLookup.looked[0]?.name)) ??
    "a homebrew spell";
  const own = pickedLookup.looked[0];
  const unread = pickedLookup.failed || own === null;
  const chosen = level ?? own?.level;
  const levels = own ? levelsFrom(own.level) : [];

  function pick(ref: EntryRef, name: string) {
    setPicked({ ref, name });
    setLevel(undefined);
  }

  function leave(to: "end" | "picker") {
    setPicked(undefined);
    setFocusNext(to);
  }

  async function endHeld() {
    if (!busy && (await onEnd(`Concentration on ${heldLabel} ended`))) setFocusNext("picker");
  }

  async function concentrate() {
    if (busy || !picked || chosen === undefined) return;
    const started = `Concentrating on ${picked.name} at ${levelName(chosen)}`;
    const announced = held ? `${started}; ${heldLabel} ended` : started;
    if (await onSet({ spell: picked.ref, level: chosen }, announced)) leave("end");
  }

  return (
    <div ref={root} className="mt-2 flex flex-col gap-1.5">
      {held && (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-row">
            <span className="text-muted">Concentrating on </span>
            <span className="font-semibold">{heldLabel}</span>, {levelName(held.level)}
          </p>
          <button ref={end} type="button" aria-disabled={busy} onClick={endHeld} className={BUTTON}>
            End concentration
          </button>
        </div>
      )}
      {picked ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-row">
            <span className="text-muted">Concentrate on </span>
            <span className="font-semibold">{picked.name}</span>
          </p>
          {unread ? (
            <p role="alert" className="text-error text-row">
              Couldn't read the spell's level.
            </p>
          ) : (
            <FormField label="Spell level">
              {(control) => (
                <Select
                  {...control}
                  aria-disabled={own === undefined}
                  value={chosen === undefined ? "" : String(chosen)}
                  options={levels.map((each) => ({
                    value: String(each),
                    label: each === 0 ? "Cantrip" : `Level ${each}`,
                  }))}
                  onChange={(next) => setLevel(Number(next))}
                />
              )}
            </FormField>
          )}
          {held && <p className="text-muted text-row">Ends concentration on {heldLabel}.</p>}
          <div className="flex gap-2">
            <button
              ref={confirm}
              type="button"
              aria-disabled={busy || chosen === undefined}
              onClick={concentrate}
              className={BUTTON}
            >
              Concentrate
            </button>
            <button type="button" onClick={() => leave("picker")} className={BUTTON}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <CatalogPicker
          label="Concentrate on a spell"
          labelHidden
          edition={edition}
          type="spell"
          filters={CONCENTRATION_FILTER}
          onPick={(ref, hit) => pick(ref, hit.name)}
          placeholder="Concentrate on a spell…"
        />
      )}
    </div>
  );
}
