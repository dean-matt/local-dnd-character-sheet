import { HOMEBREW_SOURCE, type HomebrewSkillRecord, homebrewSkillRecordSchema } from "@dnd/catalog";
import { type CharacterRecord, refKey } from "@dnd/character";
import { Plus } from "lucide-react";
import { type RefObject, useState } from "react";
import { Link } from "react-router";
import { useHomebrew } from "../../../hooks/useHomebrew.ts";
import { useReturnFocus } from "../../../hooks/useReturnFocus.ts";
import { useSaveToast } from "../../../hooks/useSaveToast.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { InputField } from "../../InputField.tsx";
import { Modal } from "../../Modal.tsx";
import { ModalEntry } from "../../ModalEntry.tsx";

/**
 * The Skills card's Add skill button, opening a modal that searches the homebrew skills of the
 * character's edition it does not yet hold. Picking one cites it by `(name, source)` at no
 * proficiency, with a flat number of 0 for a flat one, and closes the modal. A skill is made in
 * Settings, never here, so one character's table need not carry every skill another's does.
 * `buttonRef` is the button, which takes focus back after a pick or a removal.
 */
export function AddHomebrewSkill({
  character,
  buttonRef,
  onAdded,
}: {
  character: CharacterRecord;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onAdded: (name: string) => void;
}) {
  const update = useUpdateCharacterDefinition(character.id);
  const skills = useHomebrew("skills", homebrewSkillRecordSchema).list.data;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [failure, setFailure] = useState<{ error: Error; retry: () => void }>();
  const returned = useReturnFocus<HTMLButtonElement>(open);
  useSaveToast(
    "Homebrew skills",
    failure ? `Couldn't save: ${failure.error.message}` : undefined,
    failure?.retry,
    failure?.error,
  );
  const held = new Set(character.definition.proficiencies.skills.map(({ ref }) => refKey(ref)));
  const ofEdition = (skills ?? []).filter(({ edition }) => edition === character.edition);
  const available = ofEdition.filter(
    ({ name }) => !held.has(refKey({ name, source: HOMEBREW_SOURCE })),
  );
  const needle = query.trim().toLowerCase();
  const shown = available.filter(({ name }) => name.toLowerCase().includes(needle));

  function hold(record: HomebrewSkillRecord) {
    update
      .mutateAsync((latest) => ({
        ...latest,
        proficiencies: {
          ...latest.proficiencies,
          skills: [
            ...latest.proficiencies.skills,
            {
              ref: { name: record.name, source: HOMEBREW_SOURCE },
              level: "none" as const,
              ...(record.json.ability === "flat" && { flat: 0 }),
            },
          ],
        },
      }))
      .then(
        () => {
          setFailure(undefined);
          onAdded(record.name);
        },
        (error: Error) => setFailure({ error, retry: () => hold(record) }),
      );
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  const empty =
    ofEdition.length === 0
      ? "No homebrew skills yet."
      : available.length === 0
        ? "This character holds every homebrew skill."
        : undefined;

  return (
    <>
      <button
        ref={(element) => {
          returned.current = element;
          buttonRef.current = element;
        }}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-0.5 rounded-control p-1 font-semibold text-accent-text normal-case tracking-normal hover:bg-subtle"
      >
        <Plus aria-hidden="true" size={12} />
        Add skill
      </button>
      {open && (
        <Modal onClose={close}>
          <ModalEntry title="Add a skill">
            {empty ? (
              <p className="text-muted text-row">
                {empty}{" "}
                <Link to="/settings/homebrew" className="text-accent-text underline">
                  Make one in Settings
                </Link>
                .
              </p>
            ) : (
              <>
                <InputField
                  label="Search homebrew skills"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  // biome-ignore lint/a11y/noAutofocus: the modal exists to search.
                  autoFocus
                />
                {shown.length === 0 ? (
                  <p className="text-muted text-row">No matches</p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {shown.map((record) => (
                      <li key={record.id}>
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            hold(record);
                          }}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-control px-2 py-1.5 text-left text-row hover:bg-subtle"
                        >
                          {record.name}
                          <span className="text-muted">
                            {record.json.ability === "flat"
                              ? "Flat bonus"
                              : record.json.ability.toUpperCase()}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </ModalEntry>
        </Modal>
      )}
    </>
  );
}
