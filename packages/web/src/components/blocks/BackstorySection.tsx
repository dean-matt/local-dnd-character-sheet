import {
  type CharacterDefinition,
  type CharacterRecord,
  characterDefinitionSchema,
} from "@dnd/character";
import { useUpdateCharacterDefinition } from "../../hooks/useUpdateCharacterDefinition.ts";
import { Field } from "../Field/Field.tsx";
import { SectionUnavailable } from "./SectionUnavailable.tsx";

type Backstory = CharacterDefinition["backstory"];
type BackstoryKey = keyof Backstory;

const backstoryShape = characterDefinitionSchema.shape.backstory.unwrap().shape;

const PERSONALITY: { key: BackstoryKey; label: string }[] = [
  { key: "personalityTraits", label: "Personality Traits" },
  { key: "ideals", label: "Ideals" },
  { key: "bonds", label: "Bonds" },
  { key: "flaws", label: "Flaws" },
];

/** Drops a cleared key, as the stored definition does, rather than caching it as `undefined`. */
function withBackstory(backstory: Backstory, key: BackstoryKey, value: string | undefined) {
  const { [key]: _cleared, ...rest } = backstory;
  return value === undefined ? rest : { ...rest, [key]: value };
}

/** The personality boxes over the backstory, each saved as typed on edit. */
export function BackstorySection({ character }: { character: CharacterRecord | undefined }) {
  const update = useUpdateCharacterDefinition(character?.id ?? "");
  if (!character) return <SectionUnavailable page="Backstory" />;
  const { backstory } = character.definition;
  const field = (key: BackstoryKey, label: string, inputClassName?: string) => (
    <Field
      key={key}
      mode="edit"
      multiline
      label={label}
      inputClassName={inputClassName}
      current={backstory[key]}
      format={(value) => value ?? ""}
      // Whitespace alone clears the box; any other text saves as typed, line breaks kept.
      parse={(raw) => (raw.trim() ? raw : undefined)}
      schema={backstoryShape[key]}
      onSave={async (value: string | undefined) => {
        await update.mutateAsync((latest) => ({
          ...latest,
          backstory: withBackstory(latest.backstory, key, value),
        }));
      }}
    />
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {PERSONALITY.map(({ key, label }) => field(key, label))}
      </div>
      {field("story", "Backstory", "min-h-36 text-body leading-relaxed")}
    </div>
  );
}
