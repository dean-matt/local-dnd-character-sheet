import type { CharacterRecord } from "@dnd/character";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { characterQuery } from "../../../hooks/useCharacter.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { ApiError } from "../../../lib/api.ts";
import { withoutLevelChoices } from "../../../lib/levelChoices.ts";
import { LevelChoicesForm } from "./LevelChoicesForm.tsx";
import { levelUpForm } from "./levelUpForm.ts";
import { withReopenedLevel } from "./reopenedLevel.ts";

/**
 * A past level's choices reopened in the level-up's own pickers, which read the character
 * as it stood before that level chose and start filled with what it picked. Apply writes
 * them as one edit and one undo entry; closing first writes nothing. Apply sends the
 * `updatedAt` the dialog opened on, so the API refuses it where the character changed
 * since, and the alert line then offers Reload, which restarts the choices on a fresh read.
 */
export function LevelChoicesDialog({
  character,
  level,
  onClose,
}: {
  character: CharacterRecord;
  /** The character level, counting from 1. */
  level: number;
  onClose: () => void;
}) {
  const [opened, setOpened] = useState(character);
  const [reloadFailed, setReloadFailed] = useState<string>();
  const queryClient = useQueryClient();
  const update = useUpdateCharacterDefinition(character.id);
  const { definition } = opened;
  const stale = update.error instanceof ApiError && update.error.status === 412;
  return (
    <levelUpForm.FormShell
      draftScope={`${opened.id}:${opened.updatedAt}:level-${level}`}
      defaultValues={{ ...definition, levels: definition.levels.slice(0, level) }}
      onSubmit={async (values) => {
        await update.mutateAsync({
          readAt: opened.updatedAt,
          ownUndoEntry: true,
          edit: (latest) => withReopenedLevel(latest, level, values),
        });
        onClose();
      }}
      onCancel={onClose}
    >
      {({ cancel }) => (
        <LevelChoicesForm
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
          cancel={cancel}
        />
      )}
    </levelUpForm.FormShell>
  );
}
