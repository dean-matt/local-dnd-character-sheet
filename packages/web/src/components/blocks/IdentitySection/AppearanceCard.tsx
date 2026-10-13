import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useState } from "react";
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

/** Drops a cleared key, as the stored definition does, rather than caching it as `undefined`. */
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
  const [messages, setMessages] = useState<HTMLDivElement | null>(null);
  return (
    <Card title="Appearance" messagesRef={setMessages}>
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map(({ key, label }) => (
          <Field
            key={key}
            mode="edit"
            label={label}
            placeholder="Not set"
            messageSlot={{ into: messages, name: label }}
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
