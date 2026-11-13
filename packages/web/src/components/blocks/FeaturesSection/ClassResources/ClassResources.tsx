import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  classResourceKey,
  derivedValue,
  displayName,
  isRaging,
  RAGES,
  rageBlockedBy,
  rageEnded,
  rageStarted,
  resourceLabel,
  sheetState,
  withClassResource,
} from "@dnd/character";
import { Flame, Minus, Plus, RefreshCw, X } from "lucide-react";
import { ErrorState } from "../../../../ErrorState.tsx";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { LoadingState } from "../../../../LoadingState.tsx";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";
import { PoolButton } from "../../../PoolButton.tsx";
import { DerivedValue } from "../../DerivedValue.tsx";

type Pool = CharacterState["classResources"][number];

/**
 * Each row takes the list's columns, so names, counts and buttons line up down the card. A
 * Rages row adds a rage column after the use buttons, so they stay aligned with every other row.
 */
const ROW = "col-span-full grid min-h-6 grid-cols-subgrid items-center";

/**
 * The Class Resources card: each pool the derived block lists, with its uses left against
 * the maximum the sheet shows, read through `sheetState` as a rest reads them. Spend,
 * restore and reset are each one state write, announced once it lands. An `Unlimited` pool
 * counts nothing, so it offers no use control. The Rages row also starts and ends a rage,
 * each one write that moves the use and the active effect together.
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

  if (derived.classResources.length === 0) return null;
  if (state.isPending) return <LoadingState label="Loading class resources…" />;
  if (state.isError) return <ErrorState error={state.error} />;

  const stored = state.data.state;
  const sheet = sheetState(derived, stored);

  function change(pool: Pool, maximum: number, spoken: string, expended: number) {
    const text = `${spoken}: ${maximum - expended} of ${maximum} left.`;
    replace.write(withClassResource(stored, { ...pool, expended }), text);
  }

  const isRage = (pool: { key: string; resets?: unknown }) =>
    pool.key === RAGES && pool.resets === undefined;
  const rages = derived.classResources.some(isRage);

  return (
    <Card title="Class Resources" className="max-w-full self-start">
      <ul
        className={`grid gap-x-3 gap-y-1 ${
          rages ? "grid-cols-[minmax(0,1fr)_auto_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto_auto]"
        }`}
      >
        {derived.classResources.map((pool, index) => {
          const key = classResourceKey(pool);
          const label = resourceLabel(pool.key);
          const owner = displayName(pool.class);
          const name = (
            <span className="text-row">
              {label} <span className="text-muted">{owner}</span>
            </span>
          );
          const held = sheet.classResources[index] as Pool;
          const raging = isRaging(stored);
          const blocked = rageBlockedBy(derived, held);
          const rageButton = isRage(pool) && (
            <PoolButton
              icon={raging ? X : Flame}
              label={raging ? "End rage" : "Start rage"}
              tooltip={raging ? "End rage" : (blocked ?? "Start rage")}
              disabled={replace.writing || (!raging && blocked !== null)}
              on={raging}
              onPress={() =>
                replace.write(
                  raging ? rageEnded(stored) : rageStarted(stored, held),
                  raging ? "Rage ended." : "Rage started.",
                )
              }
            />
          );
          if (pool.maximum === null) {
            return (
              <li key={key} className={ROW}>
                {name}
                <span className="col-span-2 text-muted text-row">Unlimited</span>
                {rageButton}
              </li>
            );
          }
          const maximum = derivedValue(pool.maximum);
          const spoken = `${label}, ${owner}`;
          return (
            <li key={key} className={ROW}>
              {name}
              <span className="text-row">
                {maximum - held.expended} /{" "}
                <DerivedValue name={`${spoken} maximum`} value={pool.maximum} format={String} />
              </span>
              <span className="flex gap-1">
                <PoolButton
                  icon={Minus}
                  label={`Spend a use of ${spoken}`}
                  tooltip="Spend a use"
                  disabled={replace.writing || held.expended >= maximum}
                  onPress={() => change(held, maximum, spoken, held.expended + 1)}
                />
                <PoolButton
                  icon={Plus}
                  label={`Restore a use of ${spoken}`}
                  tooltip="Restore a use"
                  disabled={replace.writing || held.expended === 0}
                  onPress={() => change(held, maximum, spoken, held.expended - 1)}
                />
                <PoolButton
                  icon={RefreshCw}
                  label={`Reset ${spoken} to full`}
                  tooltip="Reset to full"
                  disabled={replace.writing || held.expended === 0}
                  onPress={() => change(held, maximum, spoken, 0)}
                />
              </span>
              {rageButton}
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
