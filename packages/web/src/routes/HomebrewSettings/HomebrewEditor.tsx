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
import { type HomebrewKind, type HomebrewRow, stepOf, stepsOf } from "./homebrewKinds.ts";
import { useHomebrewEntryDraft } from "./useHomebrewEntryDraft.ts";

const MODES = ["Step by step", "JSON"] as const;
const VIEWS = [...MODES, "Preview"] as const;

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
 * problem holds every step after it, and each problem shows beside its field once a step or
 * a save is tried. The Preview tab, or the step past the last, shows the entry as the sheet
 * renders it, and either mode's tab returns to it at the same step. Saving replaces the whole entry; closing with changes
 * asks first.
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
  const shownProblems = tried ? problems : [];
  const title = record ? `Edit ${record.name}` : `New ${kind.noun}`;
  const noun = capitalize(kind.noun);

  /** `false` where JSON that does not parse keeps the mode where it is. */
  const switchView = (next: (typeof VIEWS)[number]) => {
    setPreviewing(next === "Preview");
    if (next === "Preview" || next === mode) return true;
    if (next === "JSON") draft.openJson();
    else if (!draft.leaveJson()) {
      setTried(true);
      return false;
    }
    return true;
  };
  const refuse = () => {
    setTried(true);
    setRefusals((count) => count + 1);
  };
  const goTo = (target: number) => {
    const held = problems.map(({ key }) => stepOf(kind, key)).filter((at) => at < target);
    if (target > step && held.length > 0) {
      setStep(Math.min(...held));
      return refuse();
    }
    setTried(false);
    if (target < stepsOf(kind).length) return setStep(target);
    switchView("Preview");
    // The step buttons and Next leave with the form, so focus moves to the tab now selected.
    document.getElementById(`${id}-tab-${VIEWS.indexOf("Preview")}`)?.focus();
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
    <Modal onClose={close} wide>
      <ModalEntry
        title={title}
        footer={
          <HomebrewEditorFooter
            failure={failure}
            onCancel={close}
            stepping={mode === "Step by step" && !previewing}
            first={step === 0}
            onAdvance={(by) => goTo(step + by)}
            saving={saving}
            onSave={save}
          />
        }
      >
        <div className="@container flex flex-col gap-3">
          <p className="text-label text-muted">
            {record ? `Edit the ${kind.noun}` : `Fill in this example ${kind.noun}`} step by step,
            or in JSON, where a pasted 5etools-shaped one replaces it. Saving replaces the whole
            entry, and the source is always Homebrew.
          </p>
          <HomebrewViewTabs
            label={`${noun} editor`}
            idPrefix={id}
            views={VIEWS}
            view={previewing ? "Preview" : mode}
            onView={switchView}
          />
          <div
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${VIEWS.indexOf(previewing ? "Preview" : mode)}`}
            className="flex min-w-0 flex-col gap-3"
          >
            {previewing ? (
              <HomebrewPreview noun={kind.noun} shown={draft.shown} />
            ) : (
              <form
                ref={form}
                aria-label={title}
                noValidate
                onSubmit={(event) => event.preventDefault()}
                onKeyDown={(event) => {
                  // Handled here, not by submitting: a form submits on Enter only where it holds
                  // one text field or a submit button, and Save sits in the footer outside it.
                  const { target } = event;
                  if (event.key !== "Enter" || !(target instanceof HTMLInputElement)) return;
                  if (target.type === "checkbox") return;
                  event.preventDefault();
                  // Enter walks the steps rather than saving past the ones not yet seen.
                  if (mode === "Step by step") goTo(step + 1);
                  else save();
                }}
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
                    shownProblems={shownProblems}
                    onStep={goTo}
                  />
                )}
              </form>
            )}
          </div>
        </div>
      </ModalEntry>
    </Modal>
  );
}
