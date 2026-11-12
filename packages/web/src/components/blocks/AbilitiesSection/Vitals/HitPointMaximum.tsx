import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  characterDerivedSchema,
  deathSaveStatus,
  derivedValue,
  type HitPointMaximumReduction,
  hitPointMaximumUnder,
  maximumBeforeReduction,
  maximumReducedState,
} from "@dnd/character";
import { X } from "lucide-react";
import { useContext, useState } from "react";
import { z } from "zod";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Field } from "../../../Field/Field.tsx";
import { SaveOverride } from "../../../overrideContext.ts";
import { Popover } from "../../../Popover.tsx";
import { DerivedBreakdown } from "../../DerivedBreakdown.tsx";
import { HitPointTermList } from "./HitPointTermList.tsx";
import { HATCH } from "./hitPointRing.ts";
import { SwatchRow } from "./SwatchRow.tsx";

const { shape } = characterDerivedSchema;

/** Digits alone, so `Number` cannot read "1e1", "0x1E" or a sign; an empty field is none. */
const parseCount = (raw: string) =>
  raw.trim() === "" ? 0 : /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;

const count = (value: number) => (value === 0 ? "" : String(value));

const WHOLE = { error: "The amount is a whole number." };

const lasting = ({ clearsOnLongRest }: HitPointMaximumReduction) =>
  clearsOnLongRest ? "until a long rest" : "past a long rest";

/**
 * The hit point maximum, behind a breakdown. The breakdown sets temporary hit points, the
 * reduction to the maximum, whether the reduction lasts past a long rest and, on the character
 * page, the override; a click holds it open, with Close. The terms and "Overridden from" both
 * read the maximum before the reduction, which the override replaces. Each change is one state
 * write, made against the state every earlier write left, and announced; a field outlines a
 * write that failed and keeps its text. The fields read the state and the definition, which
 * take a write at once, so none shows a stale value while the derived block reloads.
 */
export function HitPointMaximum({
  character,
  derived,
  state,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
}) {
  const replace = useAnnouncedStateWrite(character.id);
  const saveOverride = useContext(SaveOverride);
  const [lastingError, setLastingError] = useState<string>();
  const { definition } = character;
  const before = maximumBeforeReduction(definition, derived);
  const unreduced = derivedValue(before);
  const held = state.hitPointMaximumReduction;
  const { temporary } = state.hitPoints;
  const value = derived.hitPointMaximum;
  // The override replaces the maximum before the reduction, so that is what it is marked over.
  const shown = value.manual === null ? value : { ...value, computed: before.computed };
  const dead = deathSaveStatus(derived, state) === "dead";
  const holds = saveOverride
    ? "Breakdown, temporary hit points, reduction and override"
    : "Breakdown, temporary hit points and reduction";

  /** `change` runs when the write starts; where it returns nothing, nothing is written. */
  async function save(
    change: (latest: CharacterState) => { after: CharacterState; text: string } | undefined,
  ) {
    let said: string | undefined;
    await replace.mutateAsync((latest) => {
      const changed = change(latest);
      said = changed?.text;
      return changed?.after ?? latest;
    });
    if (said) replace.announce(said);
  }

  /**
   * `change` takes the reduction held when the write starts and gives the one to hold, or
   * `undefined` to write nothing.
   */
  function reduce(
    change: (held: HitPointMaximumReduction | null) => HitPointMaximumReduction | null | undefined,
  ) {
    return save((latest) => {
      const reduction = change(latest.hitPointMaximumReduction);
      if (reduction === undefined) return undefined;
      const after = maximumReducedState(definition, derived, latest, reduction);
      const maximum = hitPointMaximumUnder(definition, derived, reduction);
      const said = reduction
        ? `Maximum reduced by ${reduction.amount}, ${lasting(reduction)}.`
        : "Reduction cleared.";
      return { after, text: `${said} ${after.hitPoints.current ?? maximum} hit points.` };
    });
  }

  return (
    <>
      <Popover
        trigger={
          <Field mode="read" label="Hit point maximum" labelHidden value={shown} format={String} />
        }
        triggerLabel={`Hit point maximum ${derivedValue(shown)}${
          shown.manual === null ? "" : `, overridden from ${shown.computed}`
        }`}
        title={holds}
        label="Hit point maximum breakdown"
      >
        {({ pinned, close }) => (
          <span className="flex w-56 flex-col gap-1.5">
            <span className="flex items-center justify-between">
              <span className="font-semibold">Hit Points</span>
              {pinned && (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={close}
                  className="flex size-5 items-center justify-center text-muted"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </span>
            <SwatchRow label="Temporary" swatch="var(--color-temporary)">
              <Field
                mode="edit"
                label="Temporary hit points"
                labelHidden
                current={temporary}
                format={count}
                parse={parseCount}
                schema={z.int(WHOLE).refine((amount) => amount === 0 || !dead, {
                  error: `${character.name} is dead, so temporary hit points cannot be granted.`,
                })}
                inputMode="numeric"
                placeholder="0"
                inputClassName="w-16 py-0.5 text-right"
                onSave={(next: number) =>
                  save((latest) => ({
                    after: { ...latest, hitPoints: { ...latest.hitPoints, temporary: next } },
                    text:
                      next === 0
                        ? "Temporary hit points cleared."
                        : `${next} temporary hit points.`,
                  }))
                }
              />
            </SwatchRow>
            <hr className="border-border" />
            <DerivedBreakdown
              name="Hit point maximum"
              value={before}
              format={String}
              overrideKey="hitPointMaximum"
              schema={shape.hitPointMaximum.shape.computed}
              termList={(terms) => <HitPointTermList terms={terms} />}
            >
              <SwatchRow label="Reduction" swatch={HATCH}>
                <Field
                  mode="edit"
                  label="Hit point maximum reduction"
                  labelHidden
                  current={held?.amount ?? 0}
                  format={count}
                  parse={parseCount}
                  schema={z.int(WHOLE).max(unreduced - 1, {
                    error: `The reduction is less than the maximum, ${unreduced}.`,
                  })}
                  inputMode="numeric"
                  placeholder="0"
                  inputClassName="w-16 py-0.5 text-right"
                  onSave={(amount: number) =>
                    reduce((latest) =>
                      amount === 0
                        ? null
                        : { amount, clearsOnLongRest: latest?.clearsOnLongRest ?? true },
                    )
                  }
                />
              </SwatchRow>
              {held && (
                <label className="flex items-center gap-1.5 pl-4 text-muted">
                  <input
                    type="checkbox"
                    checked={!held.clearsOnLongRest}
                    onChange={() => {
                      setLastingError(undefined);
                      reduce((latest) =>
                        latest
                          ? { ...latest, clearsOnLongRest: !latest.clearsOnLongRest }
                          : undefined,
                      ).catch((error) =>
                        setLastingError(error instanceof Error ? error.message : "Save failed."),
                      );
                    }}
                  />
                  Lasts past a long rest
                </label>
              )}
              {lastingError && (
                <p role="alert" className="text-error">
                  The reduction was not changed: {lastingError}
                </p>
              )}
            </DerivedBreakdown>
            <hr className="border-border" />
            <span className="flex justify-between gap-4 font-semibold">
              <span>Maximum</span>
              <span>{hitPointMaximumUnder(definition, derived, held)}</span>
            </span>
          </span>
        )}
      </Popover>
      <Announcer announced={replace.announced} />
    </>
  );
}
