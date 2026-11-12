import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  type CharacterStateRecord,
  characterDerivedSchema,
  derivedValue,
  type HitPointMaximumReduction,
  hitPointMaximumUnder,
  maximumBeforeReduction,
  maximumReducedState,
} from "@dnd/character";
import { useQueryClient } from "@tanstack/react-query";
import { useContext, useRef, useState } from "react";
import { z } from "zod";
import { characterStateKey } from "../../../../hooks/characterKeys.ts";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Field } from "../../../Field/Field.tsx";
import { SaveOverride } from "../../../overrideContext.ts";
import { Popover } from "../../../Popover.tsx";
import { TermList } from "../../../TermList.tsx";
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
 * The hit point maximum, behind a breakdown that sets temporary hit points, the reduction to the
 * maximum and whether it lasts past a long rest, and on the character page the override. The
 * terms and "Overridden from" both read the maximum before the reduction, which the override
 * replaces. Each change is one state write, made in turn against the state the last one left,
 * and announced; a field outlines a write that failed and keeps its text. The fields read the
 * state and the definition, which take a write at once, so none shows a stale value while the
 * derived block reloads.
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
  const queryClient = useQueryClient();
  const replace = useAnnouncedStateWrite(character.id);
  const saveOverride = useContext(SaveOverride);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [lastingError, setLastingError] = useState<string>();
  const { definition } = character;
  const before = maximumBeforeReduction(definition, derived);
  const unreduced = derivedValue(before);
  const held = state.hitPointMaximumReduction;
  const { temporary } = state.hitPoints;
  const value = derived.hitPointMaximum;
  const holds = saveOverride
    ? "Breakdown, temporary hit points, reduction and override"
    : "Breakdown, temporary hit points and reduction";

  function save(change: (latest: CharacterState) => { after: CharacterState; text: string }) {
    const run = async () => {
      const latest =
        queryClient.getQueryData<CharacterStateRecord>(characterStateKey(character.id))?.state ??
        state;
      const { after, text } = change(latest);
      await replace.mutateAsync(after);
      replace.announce(text);
    };
    const next = queue.current.then(run);
    queue.current = next.catch(() => {});
    return next;
  }

  /** `change` takes the reduction held when the write starts and gives the one to hold. */
  function reduce(
    change: (held: HitPointMaximumReduction | null) => HitPointMaximumReduction | null,
  ) {
    return save((latest) => {
      const reduction = change(latest.hitPointMaximumReduction);
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
          <Field mode="read" label="Hit point maximum" labelHidden value={value} format={String} />
        }
        triggerLabel={`Hit point maximum ${derivedValue(value)}${
          value.manual === null ? "" : `, overridden from ${value.computed}`
        }`}
        title={holds}
        label="Hit point maximum breakdown"
      >
        <span className="flex w-56 flex-col gap-1.5">
          <SwatchRow label="Temporary" swatch="var(--color-temporary)">
            <Field
              mode="edit"
              label="Temporary hit points"
              labelHidden
              current={temporary}
              format={count}
              parse={parseCount}
              schema={z.int(WHOLE)}
              inputMode="numeric"
              placeholder="0"
              inputClassName="w-16 py-0.5 text-right"
              onSave={(next: number) =>
                save((latest) => ({
                  after: { ...latest, hitPoints: { ...latest.hitPoints, temporary: next } },
                  text:
                    next === 0 ? "Temporary hit points cleared." : `${next} temporary hit points.`,
                }))
              }
            />
          </SwatchRow>
          <hr className="border-border" />
          {before.manual !== null ? (
            <p>
              Overridden from {before.computed}.
              {saveOverride && " Clear the override to return to it."}
            </p>
          ) : (
            before.terms && before.terms.length > 0 && <TermList terms={before.terms} />
          )}
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
                  reduce(
                    (latest) => latest && { ...latest, clearsOnLongRest: !latest.clearsOnLongRest },
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
          {saveOverride && (
            <SwatchRow label="Override">
              <Field
                mode="edit"
                label="Hit point maximum override"
                labelHidden
                value={before}
                format={String}
                parse={parseCount}
                schema={shape.hitPointMaximum.shape.computed}
                inputClassName="w-16 py-0.5 text-right"
                onSave={(next: number | null) => saveOverride("hitPointMaximum", next)}
              />
            </SwatchRow>
          )}
          <hr className="border-border" />
          <span className="flex justify-between gap-4 font-semibold">
            <span>Maximum</span>
            <span>{hitPointMaximumUnder(definition, derived, held)}</span>
          </span>
        </span>
      </Popover>
      <Announcer announced={replace.announced} />
    </>
  );
}
