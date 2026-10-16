import { useEffect, useId, useRef, useState } from "react";
import { Modal } from "../../components/Modal.tsx";
import { ModalEntry } from "../../components/ModalEntry.tsx";
import { capitalize } from "../../lib/capitalize.ts";
import { HomebrewEditorFooter } from "./HomebrewEditorFooter.tsx";
import { HomebrewEntrySettings } from "./HomebrewEntrySettings.tsx";
import { HomebrewJsonMode } from "./HomebrewJsonMode.tsx";
import { HomebrewPreview } from "./HomebrewPreview.tsx";
import { HomebrewStepMode } from "./HomebrewStepMode.tsx";
import { HomebrewViewTabs } from "./HomebrewViewTabs.tsx";
import { type HomebrewKind, type HomebrewRow, stepOf } from "./homebrewKinds.ts";
import { useHomebrewEntryDraft } from "./useHomebrewEntryDraft.ts";

const MODES = ["Step by step", "JSON"] as const;

export interface HomebrewEditorProps {
  kind: HomebrewKind;
  /** The row being replaced; absent for a new one. */
  record: HomebrewRow | undefined;
  saving: boolean;
  /** Why the last save failed, such as a name another row holds. */
  failure: string | undefined;
  onSave: (input: unknown) => void;
  onClose: () => void;
}

/**
 * A homebrew entry in a modal, edited step by step through its kind's form and reviewed at
 * the end, or as the 5etools-shaped JSON it is stored as beside the kind's field reference.
 * Both modes edit one entry, so a change in either shows in the other and a field the form
 * has no control for survives it. Leaving JSON waits until the text parses. A step holding a
 * problem does not advance, and each problem shows beside its field once a step or a save
 * is tried. Preview shows the entry as the sheet renders it, then returns to the same mode
 * and step. Saving replaces the whole entry; closing with changes asks first.
 */
export function HomebrewEditor({
  kind,
  record,
  saving,
  failure,
  onSave,
  onClose,
}: HomebrewEditorProps) {
  const draft = useHomebrewEntryDraft(kind, record);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  /** Counts each refused Next or save, so focus moves to the first field it names. */
  const [refusals, setRefusals] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  // A refusal changes nothing a screen reader announces, so focus carries it to the field.
  useEffect(() => {
    if (refusals > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [refusals]);
  const mode = draft.text === undefined ? MODES[0] : MODES[1];
  const problems = "problems" in draft.checked ? draft.checked.problems : [];
  const current = kind.steps[step];
  const shownProblems = tried ? problems : [];
  const title = record ? `Edit ${record.name}` : `New ${kind.noun}`;
  const noun = capitalize(kind.noun);

  const switchMode = (next: (typeof MODES)[number]) => {
    if (next === mode) return;
    if (next === "JSON") draft.openJson();
    else if (!draft.leaveJson()) setTried(true);
  };
  const refuse = () => {
    setTried(true);
    setRefusals((count) => count + 1);
  };
  const advance = (by: number) => {
    if (by > 0 && problems.some(({ key }) => stepOf(kind, key) === step)) return refuse();
    setTried(false);
    setStep(step + by);
  };
  const save = () => {
    if ("input" in draft.checked) {
      if (!saving) onSave(draft.checked.input);
      return;
    }
    refuse();
    setPreviewing(false);
    if (mode === "Step by step") setStep(Math.min(...problems.map(({ key }) => stepOf(kind, key))));
  };
  const close = () => {
    if (!draft.changed || window.confirm(`Discard your changes to ${title}?`)) onClose();
  };

  const settings = (
    <HomebrewEntrySettings
      edition={draft.edition}
      onEdition={draft.pickEdition}
      starters={record ? [] : kind.starters}
      starter={draft.starter.label}
      onStarter={draft.pickStarter}
    />
  );

  return (
    <Modal onClose={close}>
      <ModalEntry
        title={title}
        footer={
          <HomebrewEditorFooter
            failure={failure}
            previewing={previewing}
            onPreview={() => setPreviewing(!previewing)}
            stepping={mode === "Step by step" && !previewing}
            first={step === 0}
            last={current === undefined}
            onAdvance={advance}
            saving={saving}
            onSave={save}
          />
        }
      >
        {previewing ? (
          <HomebrewPreview noun={kind.noun} shown={draft.shown} />
        ) : (
          <form
            ref={form}
            aria-label={title}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              // Enter walks the steps rather than saving past the ones not yet seen.
              if (mode === "Step by step" && current) advance(1);
              else save();
            }}
            className="@container flex flex-col gap-3"
          >
            <p className="text-label text-muted">
              {record ? `Edit the ${kind.noun}` : `Fill in this example ${kind.noun}`} step by step,
              or switch to JSON to paste a 5etools-shaped one over it. Saving replaces the whole
              entry, and the source is always Homebrew.
            </p>
            <HomebrewViewTabs
              label={`${noun} editor`}
              idPrefix={id}
              views={MODES}
              view={mode}
              onView={switchMode}
            />
            <div
              id={`${id}-panel`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${MODES.indexOf(mode)}`}
              className="flex min-w-0 flex-col gap-3"
            >
              {mode === "JSON" ? (
                <>
                  {settings}
                  <HomebrewJsonMode
                    noun={noun}
                    reference={kind.reference}
                    text={draft.text ?? ""}
                    problems={shownProblems}
                    onText={draft.typeJson}
                  />
                </>
              ) : (
                <HomebrewStepMode
                  kind={kind}
                  step={step}
                  draft={draft}
                  settings={settings}
                  problems={problems}
                  shownProblems={shownProblems}
                />
              )}
            </div>
          </form>
        )}
      </ModalEntry>
    </Modal>
  );
}
