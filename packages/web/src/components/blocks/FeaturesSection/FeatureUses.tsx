import type { LimitedUses } from "@dnd/catalog";
import { withFeatureUse } from "@dnd/character";
import { Minus, Plus } from "lucide-react";
import { useAnnouncedStateWrite } from "../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../hooks/useCharacterState.ts";
import { Announcer } from "../../Announcer.tsx";
import { PoolButton } from "./PoolButton.tsx";

/** `short` is restored by either rest, so it reads as the shorter one. */
const RESET: Record<LimitedUses["reset"], string> = { short: "Short rest", long: "Long rest" };

/**
 * A feature's uses left against its count and the rest that restores them, with a spend and
 * a restore, each one state write announced once it lands. Nothing shows until state loads,
 * since the count left is read from it. A spent count past the count, left by a catalog whose
 * count has since fallen, reads as none left.
 */
export function FeatureUses({
  characterId,
  name,
  uses,
}: {
  characterId: string;
  name: string;
  uses: LimitedUses;
}) {
  const state = useCharacterState(characterId);
  const replace = useAnnouncedStateWrite(characterId);
  if (!state.isSuccess) return null;

  const stored = state.data.state;
  const held = stored.featureUses.find((use) => use.key === uses.key)?.expended ?? 0;
  const expended = Math.min(held, uses.count);
  const reset = RESET[uses.reset];
  const change = (next: number) =>
    replace.write(
      withFeatureUse(stored, uses.key, next),
      `${name}: ${uses.count - next} of ${uses.count} left.`,
    );

  return (
    <span className="flex items-center gap-1.5">
      <span className="text-row">
        {uses.count - expended} / {uses.count} <span className="text-muted">{reset}</span>
      </span>
      <PoolButton
        icon={Minus}
        label={`Spend a use of ${name}`}
        tooltip="Spend a use"
        disabled={replace.writing || expended >= uses.count}
        onPress={() => change(expended + 1)}
      />
      <PoolButton
        icon={Plus}
        label={`Restore a use of ${name}`}
        tooltip="Restore a use"
        disabled={replace.writing || expended === 0}
        onPress={() => change(expended - 1)}
      />
      {replace.error && (
        <span role="alert" className="text-error text-row">
          {name} was not changed: {replace.error.message}
        </span>
      )}
      <Announcer announced={replace.announced} />
    </span>
  );
}
