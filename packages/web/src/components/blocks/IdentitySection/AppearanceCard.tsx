import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";

type Appearance = CharacterDefinition["appearance"];
type AppearanceKey = keyof Appearance;

const appearanceShape = characterDefinitionSchema.shape.appearance.unwrap().shape;

const FIELDS: { key: AppearanceKey; label: string }[] = [
  { key: "age", label: "Age" },
  { key: "height", label: "Height" },
  { key: "weight", label: "Weight" },
  { key: "eyes", label: "Eyes" },
  { key: "skin", label: "Skin" },
  { key: "hair", label: "Hair" },
];

/** Drops the key rather than storing an empty string, which the schema refuses. */
function withAppearance(appearance: Appearance, key: AppearanceKey, value: string | undefined) {
  const { [key]: _cleared, ...rest } = appearance;
  return value === undefined ? rest : { ...rest, [key]: value };
}

export function AppearanceCard({
  appearance,
  onSave,
}: {
  appearance: Appearance;
  onSave: (edit: (latest: Appearance) => Appearance) => Promise<void>;
}) {
  return (
    <Card title="Appearance">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ key, label }) => (
          <Field
            key={key}
            mode="edit"
            label={label}
            placeholder="Not set"
            current={appearance[key]}
            format={(value) => value ?? ""}
            parse={(raw) => raw.trim() || undefined}
            schema={appearanceShape[key]}
            onSave={(value: string | undefined) =>
              onSave((latest) => withAppearance(latest, key, value))
            }
          />
        ))}
      </div>
    </Card>
  );
}
