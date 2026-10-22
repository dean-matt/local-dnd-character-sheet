import type { CharacterRecord } from "@dnd/character";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { characterQuery } from "../../../hooks/useCharacter.ts";
import { useLevelDice } from "../../../hooks/useLevelDice.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { ApiError } from "../../../lib/api.ts";
import { withoutLevelChoices } from "../../../lib/levelChoices.ts";
import {
  draftedGain,
  type GainDraft,
  typedGainMessage,
  withLevelGain,
} from "../../../lib/levelGain.ts";
import type { LevelHistoryRow } from "../../../lib/levelHistory.ts";
import { LevelEditForm } from "./LevelEditForm.tsx";
import { LevelGainEdit } from "./LevelGainEdit.tsx";
import { LevelRemoval } from "./LevelRemoval.tsx";
import { levelUpForm } from "./levelUpForm.ts";
import { type StartingSwap, withReopenedLevel } from "./reopenedLevel.ts";

/**
 * A past level's hit point gain and choices, reopened in the level-up's own pickers, which
 * read the character as it stood before that level chose and start filled with what it
 * picked. Apply writes the gain and the choices as one edit and one undo entry; closing first
 * writes nothing. Apply sends the `updatedAt` the dialog opened on, so the API refuses it
 * where the character changed since, and the alert line then offers Reload, which restarts
 * the choices on a fresh read. A new starting class's proficiency swap is applied to the
 * record the write reads. A level past the first also offers its removal, whose confirmation
 * takes the dialog's place until it is cancelled.
 */
export function LevelEditDialog({
  character,
  rows,
  onClose,
  onRemoved,
}: {
  character: CharacterRecord;
  /** This level, then every level after it, oldest first. */
  rows: readonly [LevelHistoryRow, ...LevelHistoryRow[]];
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { level } = rows[0];
  const [opened, setOpened] = useState(character);
  const [reloadFailed, setReloadFailed] = useState<string>();
  const [gain, setGain] = useState<GainDraft>();
  const [refused, setRefused] = useState(false);
  const [removing, setRemoving] = useState(false);
  const queryClient = useQueryClient();
  const update = useUpdateCharacterDefinition(character.id);
  const dice = useLevelDice(character.definition.levels);
  const { definition } = opened;
  const stale = update.error instanceof ApiError && update.error.status === 412;
  const swap = useRef<StartingSwap>(undefined);
  return (
    <levelUpForm.FormShell
      draftScope={`${opened.id}:${opened.updatedAt}:level-${level}`}
      defaultValues={{ ...definition, levels: definition.levels.slice(0, level) }}
      onSubmit={async (values) => {
        const edit = gain && draftedGain(gain);
        if (gain && !edit) {
          setRefused(true);
          throw new Error(typedGainMessage);
        }
        await update.mutateAsync({
          readAt: opened.updatedAt,
          ownUndoEntry: true,
          edit: (latest) => {
            const chosen = withReopenedLevel(latest, level, values, swap.current);
            return edit && dice ? withLevelGain(chosen, level - 1, edit, dice) : chosen;
          },
        });
        onClose();
      }}
      onCancel={onClose}
    >
      {({ cancel }) =>
        removing ? (
          <LevelRemoval
            character={character}
            rows={rows}
            onBack={() => setRemoving(false)}
            onRemoved={onRemoved}
          />
        ) : (
          <LevelEditForm
            before={withoutLevelChoices(definition, level)}
            definition={definition}
            level={level}
            saving={update.isPending}
            error={
              reloadFailed
                ? `${update.error?.message} Reload failed: ${reloadFailed}`
                : update.error?.message
            }
            onReload={
              stale
                ? () =>
                    queryClient.fetchQuery(characterQuery(character.id)).then(
                      (fresh) => {
                        setReloadFailed(undefined);
                        setOpened(fresh);
                        update.reset();
                      },
                      (error: Error) => setReloadFailed(error.message),
                    )
                : undefined
            }
            onSwap={(next) => {
              swap.current = next;
            }}
            hitPoints={(die) =>
              dice && die ? (
                <LevelGainEdit
                  level={level}
                  die={die}
                  entry={character.definition.levels[level - 1] ?? {}}
                  draft={gain}
                  onDraft={(next) => {
                    setGain(next);
                    setRefused(false);
                  }}
                  refused={refused}
                />
              ) : (
                <p className="text-muted">Loading the hit die…</p>
              )
            }
            gainChanged={gain !== undefined}
            onRemove={level > 1 ? () => setRemoving(true) : undefined}
            cancel={cancel}
          />
        )
      }
    </levelUpForm.FormShell>
  );
}
