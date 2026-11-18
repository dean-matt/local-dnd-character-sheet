import type { FeatureGroup, LimitedUses } from "@dnd/catalog";
import {
  type CharacterDerived,
  type CharacterRecord,
  effectEnded,
  effectRunning,
  effectStarted,
} from "@dnd/character";
import { Play, X } from "lucide-react";
import { useAnnouncedStateWrite } from "../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../hooks/useCharacterState.ts";
import { featureResource } from "../../../lib/featureResource.ts";
import { Announcer } from "../../Announcer.tsx";
import { PoolButton } from "../../PoolButton.tsx";

/**
 * Starts and ends a feature's effect, each one announced state write. A start spends what a
 * Use of the feature spends, and refuses where that is spent out; an end restores nothing.
 */
export function FeatureEffect({
  character,
  derived,
  name,
  source,
  uses,
  group,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  name: string;
  source: string;
  uses: LimitedUses | undefined;
  group: Pick<FeatureGroup, "class">;
}) {
  const state = useCharacterState(character.id);
  const replace = useAnnouncedStateWrite(character.id);
  if (!state.isSuccess) return null;

  const stored = state.data.state;
  const running = effectRunning(stored, name);
  const resource = featureResource(
    derived,
    stored,
    character.definition.edition,
    { name, source, uses },
    group,
  );
  const blocked = running ? null : (resource?.blocked ?? null);

  return (
    <>
      <PoolButton
        icon={running ? X : Play}
        label={running ? `End ${name}` : `Start ${name}`}
        tooltip={running ? "End" : (blocked ?? "Start")}
        disabled={replace.writing || blocked !== null}
        on={running}
        onPress={() =>
          replace.write(
            running
              ? effectEnded(stored, name)
              : effectStarted(resource ? resource.spend(stored) : stored, name),
            running ? `${name} ended.` : `${name} started.`,
          )
        }
      />
      {replace.error && (
        <span role="alert" className="text-error text-row">
          {name} was not changed: {replace.error.message}
        </span>
      )}
      <Announcer announced={replace.announced} />
    </>
  );
}
