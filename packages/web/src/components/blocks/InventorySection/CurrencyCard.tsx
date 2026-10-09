import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";

const COINS = [
  ["platinum", "Platinum (pp)"],
  ["gold", "Gold (gp)"],
  ["electrum", "Electrum (ep)"],
  ["silver", "Silver (sp)"],
  ["copper", "Copper (cp)"],
] as const;

const coinShape = characterDefinitionSchema.shape.money.unwrap().shape;

export function CurrencyCard({
  characterId,
  money,
}: {
  characterId: string;
  money: CharacterDefinition["money"];
}) {
  const update = useUpdateCharacterDefinition(characterId);
  return (
    <Card title="Currency">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        {COINS.map(([coin, label]) => (
          <Field
            key={coin}
            mode="edit"
            label={label}
            inputMode="numeric"
            inputClassName="w-[70px] bg-subtle"
            current={money[coin]}
            format={String}
            parse={(raw) => Number(raw.trim().replaceAll(",", ""))}
            schema={coinShape[coin].unwrap()}
            onSave={async (amount: number) => {
              await update.mutateAsync((latest) => ({
                ...latest,
                money: { ...latest.money, [coin]: amount },
              }));
            }}
          />
        ))}
      </div>
    </Card>
  );
}
