import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  characterDerivedSchema,
  classResourceKey,
  displayName,
  overrideKey,
  resourceLabel,
  sheetState,
} from "@dnd/character";
import { useState } from "react";
import { ErrorState } from "../../../../ErrorState.tsx";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { useReplaceCharacterState } from "../../../../hooks/useReplaceCharacterState.ts";
import { LoadingState } from "../../../../LoadingState.tsx";
import { Card } from "../../../Card.tsx";
import { DerivedValue } from "../../DerivedValue.tsx";

type Pool = CharacterState["classResources"][number];

const schema =
  characterDerivedSchema.shape.classResources.element.shape.maximum.unwrap().shape.computed;

const BUTTON =
  "h-8 rounded-control border border-border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

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
 * counts nothing, so it offers no control.
 */
export function ClassResources({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const state = useCharacterState(character.id);
  const replace = useReplaceCharacterState(character.id);
  const [announced, setAnnounced] = useState({ text: "", count: 0 });
  if (derived.classResources.length === 0) return null;
  if (state.isPending) return <LoadingState label="Loading class resources…" />;
  if (state.isError) return <ErrorState error={state.error} />;

  const stored = state.data.state;
  const sheet = sheetState(derived, stored);

  async function spend(pool: Pool, maximum: number, spoken: string, expended: number) {
    if (replace.writing) return;
    try {
      await replace.mutateAsync(spentState(stored, { ...pool, expended }));
    } catch {
      return;
    }
    setAnnounced(({ count }) => ({
      text: `${spoken}: ${maximum - expended} of ${maximum} left.`,
      count: count + 1,
    }));
  }

  return (
    <Card title="Class Resources">
      <ul className="flex flex-col gap-1.5">
        {derived.classResources.map((pool, index) => {
          const held = sheet.classResources[index] as Pool;
          const label = resourceLabel(pool.key);
          const owner = displayName(pool.class);
          const spoken = `${label}, ${owner}`;
          const maximum = held.maximum;
          return (
            <li
              key={classResourceKey(pool)}
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="min-w-40 grow text-row">
                {label} <span className="text-muted">{owner}</span>
              </span>
              {pool.maximum === null || maximum === null ? (
                <span className="text-muted text-row">Unlimited</span>
              ) : (
                <>
                  <span className="text-row">
                    {maximum - held.expended} /{" "}
                    <DerivedValue
                      name={`${spoken} maximum`}
                      value={pool.maximum}
                      format={String}
                      overrideKey={`${overrideKey("classResources", pool, character.definition)}.maximum`}
                      schema={schema}
                    />
                  </span>
                  <span className="flex gap-1.5">
                    {held.expended < maximum && (
                      <button
                        type="button"
                        aria-label={`Spend a use of ${spoken}`}
                        aria-disabled={replace.writing}
                        onClick={() => spend(held, maximum, spoken, held.expended + 1)}
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
                          onClick={() => spend(held, maximum, spoken, held.expended - 1)}
                          className={BUTTON}
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          aria-label={`Reset ${spoken} to full`}
                          aria-disabled={replace.writing}
                          onClick={() => spend(held, maximum, spoken, 0)}
                          className={BUTTON}
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {replace.error && (
        <p role="alert" className="mt-1 text-error text-row">
          Class resources were not changed: {replace.error.message}
        </p>
      )}
      {/* Mounted while empty: a live region added with its text is often not announced.
          The keyed child replaces its node on every change, so a repeated text is announced again. */}
      <span role="status" className="sr-only">
        <span key={announced.count}>{announced.text}</span>
      </span>
    </Card>
  );
}
