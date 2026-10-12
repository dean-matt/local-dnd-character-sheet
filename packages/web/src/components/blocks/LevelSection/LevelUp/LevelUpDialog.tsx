import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { useState } from "react";
import { useCharacterDerived } from "../../../../hooks/useCharacterDerived.ts";
import { useUpdateCharacterDefinition } from "../../../../hooks/useUpdateCharacterDefinition.ts";
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
  const [opened] = useState(character);
  const [sent, setSent] = useState<Sent>();
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
          />
        </ModalEntry>
      </Modal>
    );
  }

  return (
    <levelUpForm.FormShell
      draftScope={`${opened.id}:${opened.updatedAt}`}
      defaultValues={{ ...definition, levels: [...definition.levels, { class: last.class }] }}
      // The fields the level writes replace the latest ones whole, so an edit to them made in
      // another tab while the dialog is open is lost; comparing `latest.updatedAt` to the
      // opened record's and refusing is the way out.
      onSubmit={async (values) => {
        await update.mutateAsync((latest) => ({
          ...latest,
          levels: values.levels,
          feats: values.feats,
          abilityIncreases: values.abilityIncreases,
          featureChoices: values.featureChoices,
        }));
      }}
      onCancel={onClose}
    >
      {({ cancel }) => (
        <LevelUpForm
          characterId={character.id}
          definition={definition}
          saving={update.isPending}
          error={update.error?.message}
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
