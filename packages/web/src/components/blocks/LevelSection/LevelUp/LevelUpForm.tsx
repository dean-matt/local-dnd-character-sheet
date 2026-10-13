import type { CharacterDefinition } from "@dnd/character";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Modal } from "../../../Modal.tsx";
import { ModalEntry } from "../../../ModalEntry.tsx";
import type { HitPointMethod } from "./hitPointPick.ts";
import { LevelUpChoices } from "./LevelUpChoices.tsx";
import type { LevelChange } from "./levelUpChanges.ts";
import { useLevelUpPlan } from "./useLevelUpPlan.ts";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

export interface LevelUpFormProps {
  characterId: string;
  /** The definition as the level-up opened on it, without the new level. */
  definition: CharacterDefinition;
  saving: boolean;
  error: string | undefined;
  /** Offered beside `error` where reading the character again is the way past it. */
  onReload?: () => void;
  /** Runs as Apply submits a complete level, with what the summary lists from the class table. */
  onSend: (sent: { table: LevelChange[]; features: string[] }) => void;
  cancel: () => void;
}

/**
 * The level-up's choices inside its form, and the Apply that submits them only once every
 * one is made. A draft resumed after a reload holds the face it stored, so its method
 * reads as Custom; the average stores no face, so a resumed average asks again.
 */
export function LevelUpForm({
  characterId,
  definition,
  saving,
  error,
  onReload,
  onSend,
  cancel,
}: LevelUpFormProps) {
  const { getValues } = useFormContext<CharacterDefinition>();
  const [method, setMethod] = useState<HitPointMethod | undefined>(() =>
    getValues("levels").at(-1)?.rolled === undefined ? undefined : "custom",
  );
  const plan = useLevelUpPlan(definition, method);
  const blocked = !plan.ready || saving;
  return (
    <Modal onClose={cancel}>
      <ModalEntry
        title="Level up"
        footer={
          <div className="flex items-center gap-2">
            <p role="alert" className="text-error text-row">
              {error && `Couldn't save the level: ${error}`}
              {onReload && (
                <button
                  type="button"
                  onClick={onReload}
                  className="ml-2 font-semibold text-accent underline hover:text-accent-hover"
                >
                  Reload
                </button>
              )}
            </p>
            <button
              type="button"
              onClick={cancel}
              className={`${BUTTON} border border-border bg-surface text-ink hover:bg-subtle`}
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-disabled={blocked}
              onClick={(event) => {
                if (blocked) event.preventDefault();
                else onSend({ table: plan.table(), features: plan.features });
              }}
              className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
            >
              {saving ? "Saving…" : "Apply level up"}
            </button>
          </div>
        }
      >
        <LevelUpChoices
          characterId={characterId}
          definition={definition}
          plan={plan}
          method={method}
          onMethod={setMethod}
        />
      </ModalEntry>
    </Modal>
  );
}
