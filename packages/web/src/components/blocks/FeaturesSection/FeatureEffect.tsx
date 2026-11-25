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
import { useFeatureRestore } from "../../../hooks/useFeatureRestore.ts";
import { featureResource } from "../../../lib/featureResource.ts";
import { Announcer } from "../../Announcer.tsx";
import { PoolButton } from "../../PoolButton.tsx";

/**
 * Starts and ends a feature's effect, each one announced state write. A start spends what a
 * Use of the feature spends and gives what a use restores, and refuses where that is spent out
 * or the armor worn ends the effect; an end restores nothing. A restore per choice is left to
 * the spend, which holds the choice.
 */
export function FeatureEffect({
  character,
  derived,
  startable,
  uses,
  group,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  startable: CharacterDerived["startableFeatures"][number];
  uses: LimitedUses | undefined;
  group: Pick<FeatureGroup, "class">;
}) {
  const state = useCharacterState(character.id);
  const replace = useAnnouncedStateWrite(character.id);
  const restore = useFeatureRestore(character.id);
  if (!state.isSuccess) return null;

  const { name, source } = startable;
  const stored = state.data.state;
  const running = effectRunning(stored, name);
  const resource = featureResource(
    derived,
    stored,
    character.definition.edition,
    { name, source, uses },
    group,
  );
  const blocked = running ? null : (startable.blockedBy ?? resource?.blocked ?? null);

  return (
    <>
      <PoolButton
        icon={running ? X : Play}
        label={running ? `End ${name}` : `Start ${name}`}
        tooltip={running ? "End" : (blocked ?? "Start")}
        disabled={replace.writing || blocked !== null}
        on={running}
        onPress={async () => {
          if (running) {
            await replace.write(effectEnded(stored, name), `${name} ended.`);
            return;
          }
          const restored = restore(
            { ...derived, featureRestores: derived.featureRestores.filter(({ per }) => !per) },
            { name, source },
            resource ? resource.spend(stored) : stored,
          );
          const text = [`${name} started.`, ...restored.text.map((part) => `${part}.`)].join(" ");
          if (await replace.write(effectStarted(restored.state, name), text)) restored.log();
        }}
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
