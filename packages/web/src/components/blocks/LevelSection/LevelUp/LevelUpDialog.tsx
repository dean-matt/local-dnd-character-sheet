import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { characterQuery } from "../../../../hooks/useCharacter.ts";
import { useCharacterDerived } from "../../../../hooks/useCharacterDerived.ts";
import { useUpdateCharacterDefinition } from "../../../../hooks/useUpdateCharacterDefinition.ts";
import { ApiError } from "../../../../lib/api.ts";
import { Modal } from "../../../Modal.tsx";
import { ModalEntry } from "../../../ModalEntry.tsx";
import { LevelUpForm } from "./LevelUpForm.tsx";
import { LevelUpSummary } from "./LevelUpSummary.tsx";
import { derivedChanges, type LevelChange } from "./levelUpChanges.ts";
import { levelUpForm } from "./levelUpForm.ts";

type Level = CharacterDefinition["levels"][number];

/** What the summary reads once the write lands, taken when Apply is pressed. */
type Sent = { before: CharacterDerived | undefined; table: LevelChange[]; features: string[] };

/**
 * One level, chosen and confirmed before anything is written, then a list of what it
 * moved. Apply writes the level and the choices it brought as one edit, so it is one undo
 * entry; closing first writes nothing.
 *
 * Apply sends the `updatedAt` the dialog opened on, and the API refuses the write where any
 * definition edit reached the server since, from this tab or another, to the second the
 * column holds. The alert line then offers Reload, which reads the character again and
 * restarts the choices on it.
 *
 * The record is read once, as the dialog opens: the written level then cannot shift the
 * class level the summary describes. Its `updatedAt` scopes the draft, so a draft resumed
 * after a reload never writes over an edit made since. A draft a later edit orphans stays
 * in storage, since nothing opens its key again; pruning the character's other level-up
 * drafts on open is the way out.
 */
export function LevelUpDialog({
  character,
  onClose,
}: {
  character: CharacterRecord;
  onClose: () => void;
}) {
  const [opened, setOpened] = useState(character);
  const queryClient = useQueryClient();
  const [sent, setSent] = useState<Sent>();
  const [reloadFailed, setReloadFailed] = useState<string>();
  const derived = useCharacterDerived(character.id);
  const update = useUpdateCharacterDefinition(character.id);
  const { definition } = opened;
  // The schema holds at least one level, which the inferred array type cannot say.
  const last = definition.levels.at(-1) as Level;

  if (update.isSuccess && sent) {
    return (
      <Modal onClose={onClose}>
        <ModalEntry
          title="Level up applied"
          footer={
            <button
              type="button"
              onClick={onClose}
              className="rounded-control bg-accent px-3.5 py-2 font-semibold text-row text-white hover:bg-accent-hover"
            >
              Done
            </button>
          }
        >
          <LevelUpSummary
            changes={summaryChanges(sent, derived.data, derived.isFetching, derived.isError)}
            features={sent.features}
            emptyNote="No value on the sheet moved."
          />
        </ModalEntry>
      </Modal>
    );
  }

  return (
    <levelUpForm.FormShell
      key={opened.updatedAt}
      draftScope={`${opened.id}:${opened.updatedAt}`}
      defaultValues={{ ...definition, levels: [...definition.levels, { class: last.class }] }}
      onSubmit={async (values) => {
        await update.mutateAsync({
          readAt: opened.updatedAt,
          edit: (latest) => ({
            ...latest,
            levels: values.levels,
            feats: values.feats,
            abilityIncreases: values.abilityIncreases,
            featureChoices: values.featureChoices,
            proficiencies: values.proficiencies,
            spells: values.spells,
            departures: values.departures,
          }),
        });
      }}
      onCancel={onClose}
    >
      {({ cancel }) => (
        <LevelUpForm
          characterId={character.id}
          definition={definition}
          saving={update.isPending}
          error={
            reloadFailed
              ? `${update.error?.message} Reload failed: ${reloadFailed}`
              : update.error?.message
          }
          onReload={
            update.error instanceof ApiError && update.error.status === 412
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
          onSend={(picked) => setSent({ before: derived.data, ...picked })}
          cancel={cancel}
        />
      )}
    </levelUpForm.FormShell>
  );
}

/**
 * The derived block's changes beside the class table's, `undefined` until the block
 * computed after the write has loaded. A block missing before the write or failing after it
 * leaves the table's changes alone.
 */
function summaryChanges(
  sent: Sent,
  now: CharacterDerived | undefined,
  fetching: boolean,
  failed: boolean,
): LevelChange[] | undefined {
  if (sent.before === undefined || failed) return sent.table;
  if (now === undefined || now === sent.before || fetching) return undefined;
  return [...derivedChanges(sent.before, now), ...sent.table];
}
