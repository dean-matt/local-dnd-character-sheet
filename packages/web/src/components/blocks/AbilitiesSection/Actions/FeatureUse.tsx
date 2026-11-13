import type { FeatureGroup, LimitedUses } from "@dnd/catalog";
import {
  ACTION_TURN_MARK,
  type ActionType,
  type CharacterDerived,
  type CharacterRecord,
  TURN_LABELS,
  turnMarkSpent,
} from "@dnd/character";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { Announcer } from "../../../Announcer.tsx";
import { featureResource } from "./featureResource.ts";

/**
 * A held feature's resource and its Use control. A Use spends the resource, if the feature has
 * one, and marks the feature's action type spent on the Turn Economy, as one state write
 * announced once it lands. Nothing shows until state loads, since the count left is read from it.
 */
export function FeatureUse({
  character,
  derived,
  name,
  source,
  type,
  group,
  uses,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  name: string;
  source: string;
  type: ActionType;
  group: Pick<FeatureGroup, "class">;
  uses: LimitedUses | undefined;
}) {
  const play = useCharacterState(character.id);
  const replace = useAnnouncedStateWrite(character.id);
  const mark = ACTION_TURN_MARK[type];
  if (!play.isSuccess) return null;

  const stored = play.data.state;
  const resource = featureResource(
    derived,
    stored,
    character.definition.edition,
    { name, source, uses },
    group,
  );
  if (!resource && !mark) return null;

  const blocked = resource?.blocked ?? null;
  const disabled = replace.writing || blocked !== null;
  const counted = resource?.total != null;

  function use() {
    if (disabled) return;
    const spent = resource ? resource.spend(stored) : stored;
    const after = mark ? turnMarkSpent(spent, mark) : spent;
    const parts = [
      resource?.total != null && resource.left != null
        ? `${name} used: ${resource.left - 1} of ${resource.total} left`
        : `${name} used`,
      ...(mark ? [`${TURN_LABELS[mark]} spent`] : []),
    ];
    replace.write(after, `${parts.join(". ")}.`);
  }

  return (
    <span className="flex items-center gap-1.5">
      {resource && (
        <span className="text-row">
          {counted ? `${resource.left} / ${resource.total}` : "Unlimited"}
          {resource.rest && <span className="text-muted"> {resource.rest}</span>}
        </span>
      )}
      <button
        type="button"
        aria-label={`Use ${name}`}
        title={blocked ?? "Use"}
        aria-disabled={disabled}
        onClick={use}
        className="h-6 rounded-control border border-border bg-surface px-2 font-semibold text-label hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        Use
      </button>
      {replace.error && (
        <span role="alert" className="text-error text-row">
          {name} was not changed: {replace.error.message}
        </span>
      )}
      <Announcer announced={replace.announced} />
    </span>
  );
}
