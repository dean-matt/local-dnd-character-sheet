import { flatSkillBonusSchema } from "@dnd/character";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { Field } from "../../Field/Field.tsx";

/**
 * A flat custom skill's base, set in the detail modal its name opens. Its own mutation
 * keeps a failed save beside the field, in the modal, and out of the list's alert, which
 * the open modal makes inert.
 */
export function FlatSkillBase({
  characterId,
  name,
  flat,
}: {
  characterId: string;
  name: string;
  flat: number;
}) {
  const update = useUpdateCharacterDefinition(characterId);

  return (
    <div className="flex items-baseline gap-2">
      <span aria-hidden="true" className="text-muted text-row">
        Flat bonus
      </span>
      <Field
        mode="edit"
        label={`${name} flat bonus`}
        labelHidden
        inputClassName="w-12 text-right"
        current={flat}
        format={String}
        parse={(raw) => Number(raw.trim())}
        schema={flatSkillBonusSchema}
        onSave={async (next: number) => {
          await update.mutateAsync((latest) => ({
            ...latest,
            customSkills: latest.customSkills.map((each) =>
              each.name === name && "flat" in each ? { ...each, flat: next } : each,
            ),
          }));
        }}
      />
    </div>
  );
}
