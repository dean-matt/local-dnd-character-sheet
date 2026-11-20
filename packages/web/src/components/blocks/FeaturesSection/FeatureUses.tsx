import type { LimitedUses } from "@dnd/catalog";
import {
  type CharacterDerived,
  featureUsesSpent,
  recoverableSlots,
  recoveredState,
  type SlotRecoveryPick,
  withFeatureUse,
} from "@dnd/character";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useAnnouncedStateWrite } from "../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../hooks/useCharacterState.ts";
import { useFeatureRestore } from "../../../hooks/useFeatureRestore.ts";
import { chosenValue, restoreChoice } from "../../../lib/restoreChoice.ts";
import { Announcer } from "../../Announcer.tsx";
import { PoolButton } from "../../PoolButton.tsx";
import { RestoreChoiceSelect } from "../../RestoreChoiceSelect.tsx";
import { RegainButton } from "./RegainButton.tsx";
import { SlotRecoveryDialog } from "./SlotRecoveryDialog.tsx";

/** `short` is restored by either rest, so it reads as the shorter one; `manual` only by the player. */
const RESET: Record<LimitedUses["reset"], string> = {
  short: "Short rest",
  long: "Long rest",
  manual: "Manual reset",
};

const RESTORED_BY: Record<NonNullable<LimitedUses["restoredBy"]>, string> = {
  initiative: "rolling initiative with none left",
  soulTrinket: "destroying a soul trinket",
};

const PART: Record<NonNullable<LimitedUses["part"]>, string> = {
  conjuring: "Conjuring",
  recovery: "Regaining",
};

/**
 * A feature's uses left against its count and the rest that restores them, with a spend and
 * a restore, each one state write announced once it lands. A spend also lands what the
 * feature restores, in the same write, then logs what it rolled. Nothing shows until state
 * loads, since the count left is read from it, and the spend waits on `derived`, which holds
 * what the feature restores.
 */
export function FeatureUses({
  characterId,
  derived,
  name,
  source,
  uses,
}: {
  characterId: string;
  derived: CharacterDerived | undefined;
  name: string;
  source: string | undefined;
  uses: LimitedUses;
}) {
  const state = useCharacterState(characterId);
  const replace = useAnnouncedStateWrite(characterId);
  const restore = useFeatureRestore(characterId);
  const [picked, setPicked] = useState<number | null>(null);
  const [recovering, setRecovering] = useState(false);
  if (!state.isSuccess) return null;

  const stored = state.data.state;
  const choice = derived && source ? restoreChoice(derived, stored, { name, source }) : null;
  const count = chosenValue(choice, picked);
  const expended = featureUsesSpent(stored, uses.key, uses.count);
  const reset = uses.restoredBy
    ? `${RESET[uses.reset]} or ${RESTORED_BY[uses.restoredBy]}`
    : RESET[uses.reset];
  const change = (next: number) =>
    replace.write(
      withFeatureUse(stored, uses.key, next),
      `${name}: ${uses.count - next} of ${uses.count} left.`,
    );

  const recovery = derived?.slotRecoveries.find(
    (each) => each.feature.name === name && each.feature.source === source,
  );

  function setDialog(open: boolean) {
    replace.reset();
    setRecovering(open);
  }

  async function recover(picks: SlotRecoveryPick[]) {
    if (!derived || !recovery) return;
    const after = withFeatureUse(
      recoveredState(derived, stored, recovery, picks),
      uses.key,
      expended + 1,
    );
    const levels = picks.map(({ level, count }) => `${count} level ${level}`).join(", ");
    const left = `${name}: ${uses.count - expended - 1} of ${uses.count} left.`;
    if (await replace.write(after, `${left} Recovered ${levels} slots.`)) setDialog(false);
  }

  return (
    <span className="flex items-center gap-1.5">
      <span className="text-row">
        {uses.part && `${PART[uses.part]}: `}
        {uses.count - expended} / {uses.count} <span className="text-muted">{reset}</span>
      </span>
      <RestoreChoiceSelect name={name} choice={choice} value={count} onChange={setPicked} />
      <PoolButton
        icon={Minus}
        label={`Spend a use of ${name}`}
        tooltip="Spend a use"
        disabled={
          replace.writing || !derived || expended >= uses.count || choice?.values.length === 0
        }
        onPress={async () => {
          if (!derived) return;
          const restored = source
            ? restore(derived, { name, source }, stored, count)
            : { state: stored, text: [], log: () => {} };
          const left = `${name}: ${uses.count - expended - 1} of ${uses.count} left.`;
          const text = [left, ...restored.text.map((part) => `${part}.`)].join(" ");
          const after = withFeatureUse(restored.state, uses.key, expended + 1);
          if (await replace.write(after, text)) restored.log();
        }}
      />
      <PoolButton
        icon={Plus}
        label={`Restore a use of ${name}`}
        tooltip="Restore a use"
        disabled={replace.writing || expended === 0}
        onPress={() => change(expended - 1)}
      />
      {recovery && (
        <button
          type="button"
          aria-label={`Recover slots with ${name}`}
          title={expended >= uses.count ? "No use left" : "Recover slots"}
          aria-disabled={replace.writing || expended >= uses.count}
          onClick={() => !replace.writing && expended < uses.count && setDialog(true)}
          className="h-6 rounded-control border border-border bg-surface px-2 font-semibold text-label hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          Recover
        </button>
      )}
      {derived && (
        <RegainButton
          derived={derived}
          stored={stored}
          name={name}
          source={source}
          uses={uses}
          expended={expended}
          writing={replace.writing}
          onRegain={replace.write}
        />
      )}
      {derived && recovery && recovering && (
        <SlotRecoveryDialog
          name={name}
          budget={recovery.budget}
          slots={recoverableSlots(derived, stored, recovery)}
          busy={replace.writing}
          error={replace.error?.message}
          onRecover={recover}
          onClose={() => setDialog(false)}
        />
      )}
      {replace.error && !recovering && (
        <span role="alert" className="text-error text-row">
          {name} was not changed: {replace.error.message}
        </span>
      )}
      <Announcer announced={replace.announced} />
    </span>
  );
}
