import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  classResourceKey,
  derivedValue,
  displayName,
  resourceLabel,
  sheetState,
} from "@dnd/character";
import { useEffect, useRef, useState } from "react";
import { ErrorState } from "../../../../ErrorState.tsx";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { LoadingState } from "../../../../LoadingState.tsx";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";
import { DerivedValue } from "../../DerivedValue.tsx";

type Pool = CharacterState["classResources"][number];

const BUTTON =
  "h-6 rounded-control border border-border bg-surface px-2 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/**
 * Each row takes the list's columns, so names, counts and buttons line up down the card. On a
 * phone the buttons drop below the name.
 */
const ROW = "col-span-3 grid min-h-6 grid-cols-subgrid items-center gap-y-1";

/** The state with one pool's entry replaced, or added where state holds none for it. */
function spentState(state: CharacterState, pool: Pool): CharacterState {
  const key = classResourceKey(pool);
  const held = state.classResources.some((candidate) => classResourceKey(candidate) === key);
  return {
    ...state,
    classResources: held
      ? state.classResources.map((candidate) =>
          classResourceKey(candidate) === key ? pool : candidate,
        )
      : [...state.classResources, pool],
  };
}

/**
 * The Class Resources card: each pool the derived block lists, with its uses left against
 * the maximum the sheet shows, read through `sheetState` as a rest reads them. Spend,
 * restore and reset are each one state write, announced once it lands. An `Unlimited` pool
 * counts nothing, so it offers no control. A write that removes the pressed button moves
 * focus to the first button left in its row.
 */
export function ClassResources({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const state = useCharacterState(character.id);
  const replace = useAnnouncedStateWrite(character.id);
  const list = useRef<HTMLUListElement>(null);
  const [landed, setLanded] = useState<{ key: string; expended: number }>();

  useEffect(() => {
    if (!landed || !state.data) return;
    const index = derived.classResources.findIndex((pool) => classResourceKey(pool) === landed.key);
    const held = sheetState(derived, state.data.state).classResources[index];
    // Until the written count renders, the pressed button may still be mounted.
    if (held?.expended !== landed.expended) return;
    setLanded(undefined);
    const row = [...(list.current?.children ?? [])].find(
      (li) => li instanceof HTMLElement && li.dataset.pool === landed.key,
    );
    if (row && !row.contains(document.activeElement))
      row.querySelector<HTMLElement>("[data-actions] button")?.focus();
  }, [landed, state.data, derived]);

  if (derived.classResources.length === 0) return null;
  if (state.isPending) return <LoadingState label="Loading class resources…" />;
  if (state.isError) return <ErrorState error={state.error} />;

  const stored = state.data.state;
  const sheet = sheetState(derived, stored);

  async function change(pool: Pool, maximum: number, spoken: string, expended: number) {
    const text = `${spoken}: ${maximum - expended} of ${maximum} left.`;
    if (await replace.write(spentState(stored, { ...pool, expended }), text)) {
      setLanded({ key: classResourceKey(pool), expended });
    }
  }

  return (
    <Card title="Class Resources" className="max-w-full self-start">
      <ul ref={list} className="grid grid-cols-[auto_auto_auto] gap-x-3 gap-y-2 sm:gap-y-1">
        {derived.classResources.map((pool, index) => {
          const key = classResourceKey(pool);
          const label = resourceLabel(pool.key);
          const owner = displayName(pool.class);
          const name = (
            <span className="text-row">
              {label} <span className="text-muted">{owner}</span>
            </span>
          );
          if (pool.maximum === null) {
            return (
              <li key={key} data-pool={key} className={ROW}>
                {name}
                <span className="col-span-2 text-muted text-row">Unlimited</span>
              </li>
            );
          }
          const held = sheet.classResources[index] as Pool;
          const maximum = derivedValue(pool.maximum);
          const spoken = `${label}, ${owner}`;
          return (
            <li key={key} data-pool={key} className={ROW}>
              {name}
              <span className="text-row">
                {maximum - held.expended} /{" "}
                <DerivedValue name={`${spoken} maximum`} value={pool.maximum} format={String} />
              </span>
              <span data-actions className="col-span-3 flex flex-wrap gap-1 sm:col-span-1">
                {held.expended < maximum && (
                  <button
                    type="button"
                    aria-label={`Spend a use of ${spoken}`}
                    aria-disabled={replace.writing}
                    onClick={() => change(held, maximum, spoken, held.expended + 1)}
                    className={BUTTON}
                  >
                    Spend
                  </button>
                )}
                {held.expended > 0 && (
                  <>
                    <button
                      type="button"
                      aria-label={`Restore a use of ${spoken}`}
                      aria-disabled={replace.writing}
                      onClick={() => change(held, maximum, spoken, held.expended - 1)}
                      className={BUTTON}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      aria-label={`Reset ${spoken} to full`}
                      aria-disabled={replace.writing}
                      onClick={() => change(held, maximum, spoken, 0)}
                      className={BUTTON}
                    >
                      Reset
                    </button>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {replace.error && (
        <p role="alert" className="mt-1 text-error text-row">
          Class resources were not changed: {replace.error.message}
        </p>
      )}
      <Announcer announced={replace.announced} />
    </Card>
  );
}
