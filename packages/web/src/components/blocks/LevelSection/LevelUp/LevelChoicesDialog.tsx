import type { CharacterRecord } from "@dnd/character";
import { useState } from "react";
import { useUpdateCharacterDefinition } from "../../../../hooks/useUpdateCharacterDefinition.ts";
import { withoutLevelChoices } from "../../../../lib/levelChoices.ts";
import { LevelChoicesForm } from "./LevelChoicesForm.tsx";
import { levelUpForm } from "./levelUpForm.ts";
import { withReopenedLevel } from "./reopenedLevel.ts";

/**
 * A past level's choices reopened in the level-up's own pickers, which read the character
 * as it stood before that level chose and start filled with what it picked. Apply writes
 * them as one edit and one undo entry; closing first writes nothing. Apply sends the
 * `updatedAt` the dialog opened on, so the API refuses it where the character changed since.
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
  const [opened] = useState(character);
  const update = useUpdateCharacterDefinition(character.id);
  const { definition } = opened;
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
          error={update.error?.message}
          cancel={cancel}
        />
      )}
    </levelUpForm.FormShell>
  );
}
