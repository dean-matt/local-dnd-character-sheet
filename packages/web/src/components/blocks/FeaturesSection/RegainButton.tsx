import type { LimitedUses } from "@dnd/catalog";
import {
  type CharacterDerived,
  type CharacterState,
  regainedState,
  withFeatureUse,
} from "@dnd/character";

/**
 * What a use of the feature regains, a pool's points, the pact slots or its own main uses,
 * written with the spent use in one state write. It sits on the feature's recovery count where
 * it keeps one, else on its main count, and offers nothing while nothing is expended.
 */
export function RegainButton({
  derived,
  stored,
  name,
  source,
  uses,
  expended,
  writing,
  onRegain,
}: {
  derived: CharacterDerived;
  stored: CharacterState;
  name: string;
  source: string | undefined;
  uses: LimitedUses;
  expended: number;
  writing: boolean;
  onRegain: (state: CharacterState, announcement: string) => Promise<boolean>;
}) {
  const regain = derived.regains.find(
    (each) => each.feature.name === name && each.feature.source === source && !each.on,
  );
  const hasRecoveryCount = derived.limitedUses.some(
    (each) =>
      each.part === "recovery" && each.feature.name === name && each.feature.source === source,
  );
  if (!regain || uses.part !== (hasRecoveryCount ? "recovery" : undefined)) return null;

  const regained = regainedState(derived, stored, regain);
  const disabled = writing || expended >= uses.count || !regained;
  return (
    <button
      type="button"
      aria-label={`Regain with ${name}`}
      title={expended >= uses.count ? "No use left" : regained ? "Regain" : "Nothing is expended"}
      aria-disabled={disabled}
      onClick={() =>
        !disabled &&
        onRegain(
          withFeatureUse(regained, uses.key, expended + 1),
          `${name}: ${uses.count - expended - 1} of ${uses.count} left. Regained.`,
        )
      }
      className="h-6 rounded-control border border-border bg-surface px-2 font-semibold text-label hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      Regain
    </button>
  );
}
