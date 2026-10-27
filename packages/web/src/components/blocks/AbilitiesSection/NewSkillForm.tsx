import { HOMEBREW_SOURCE, type HomebrewSkillRecord, homebrewSkillRecordSchema } from "@dnd/catalog";
import { ABILITIES, type CharacterDerived, type CharacterRecord } from "@dnd/character";
import { type FormEvent, type RefObject, useState } from "react";
import { useHomebrew } from "../../../hooks/useHomebrew.ts";
import { useSaveToast } from "../../../hooks/useSaveToast.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { ApiError } from "../../../lib/api.ts";
import { FormField } from "../../FormField.tsx";
import { InputField } from "../../InputField.tsx";
import { Select } from "../../Select.tsx";

type Base = (typeof ABILITIES)[number] | "flat";

const BASE_OPTIONS = [
  ...ABILITIES.map((ability) => ({ value: ability, label: ability.toUpperCase() })),
  { value: "flat", label: "Flat bonus" },
];

/** The spelling of the skill that holds the name a 409 refused, from whichever shape it answered in. */
function refusedName(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || error.status !== 409) return undefined;
  const body = error.body as { conflict?: { name?: string } } | undefined;
  return body?.conflict?.name ? `${body.conflict.name} is already a skill.` : error.message;
}

/**
 * Makes a skill the character plays that the catalog does not print: a homebrew skill of its
 * edition, with an ability or a flat bonus as its base, held by this character at no
 * proficiency. The skill is created first and then held in one definition write, so the add is
 * one undo entry and the homebrew row is not undone. A name any skill of the edition already
 * holds is refused, by the sheet at once and by the server where the sheet had not seen it.
 */
export function NewSkillForm({
  character,
  derived,
  nameField,
  onAdded,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  nameField: RefObject<HTMLInputElement | null>;
  onAdded: (name: string) => void;
}) {
  const update = useUpdateCharacterDefinition(character.id);
  const skills = useHomebrew("skills", homebrewSkillRecordSchema);
  const [name, setName] = useState("");
  const [base, setBase] = useState<Base>("str");
  const [refusal, setRefusal] = useState<string>();
  const [failure, setFailure] = useState<{ error: Error; retry: () => void }>();
  useSaveToast(
    "Skills",
    failure ? `Couldn't save: ${failure.error.message}` : undefined,
    failure?.retry,
    failure?.error,
  );

  function hold(record: HomebrewSkillRecord) {
    const ref = { name: record.name, source: HOMEBREW_SOURCE };
    update
      .mutateAsync((latest) => ({
        ...latest,
        proficiencies: {
          ...latest.proficiencies,
          skills: [
            ...latest.proficiencies.skills.filter(
              (each) => each.ref.name !== ref.name || each.ref.source !== ref.source,
            ),
            { ref, level: "none", ...(record.json.ability === "flat" && { flat: 0 }) },
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

  function known(typed: string) {
    const wanted = typed.toLowerCase();
    const sheet = derived.skills.map(({ ref }) => ref.name);
    const defined = (skills.list.data ?? [])
      .filter(({ edition }) => edition === character.edition)
      .map((each) => each.name);
    return [...sheet, ...defined].find((each) => each.toLowerCase() === wanted);
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const typed = name.trim();
    if (typed === "") return;
    const existing = known(typed);
    if (existing) return setRefusal(`${existing} is already a skill.`);
    setRefusal(undefined);
    setName("");
    nameField.current?.focus();
    try {
      const record = await skills.save.mutateAsync({
        id: undefined,
        input: { name: typed, edition: character.edition, ability: base },
      });
      hold(record);
    } catch (error) {
      const message = refusedName(error);
      if (message === undefined) return setFailure({ error: error as Error, retry: () => {} });
      setName(typed);
      setRefusal(message);
    }
  }

  return (
    <form noValidate onSubmit={add} className="mt-2 flex items-start gap-1.5">
      <div className="min-w-0 grow">
        <InputField
          ref={nameField}
          label="New skill"
          labelHidden
          placeholder="New skill"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setRefusal(undefined);
          }}
          error={refusal}
        />
      </div>
      <FormField label="New skill base" labelHidden>
        {(control) => (
          <Select
            {...control}
            options={BASE_OPTIONS}
            value={base}
            onChange={(next) => setBase(next as Base)}
          />
        )}
      </FormField>
      <button
        type="submit"
        aria-disabled={name.trim() === ""}
        className="control shrink-0 border-accent bg-accent font-semibold text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
