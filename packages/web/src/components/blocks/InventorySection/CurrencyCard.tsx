import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";
import { CoinAdjustment } from "./CoinAdjustment.tsx";

const COINS = [
  ["platinum", "Platinum", "pp"],
  ["gold", "Gold", "gp"],
  ["electrum", "Electrum", "ep"],
  ["silver", "Silver", "sp"],
  ["copper", "Copper", "cp"],
] as const;

/** Empty text is refused rather than read as `Number("")`, which is 0. */
function parseCoins(raw: string): number {
  const digits = raw.trim().replaceAll(",", "");
  if (digits === "") throw new Error("no amount");
  return Number(digits);
}

const coinShape = characterDefinitionSchema.shape.money.unwrap().shape;

export function CurrencyCard({
  characterId,
  money,
}: {
  characterId: string;
  money: CharacterDefinition["money"];
}) {
  const update = useUpdateCharacterDefinition(characterId);
  // A column is too narrow for a sentence, so every adjustment's message lands under the row.
  const [messages, setMessages] = useState<HTMLDivElement | null>(null);
  return (
    <Card title="Currency">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        {COINS.map(([coin, name, abbreviation]) => (
          <div key={coin} className="flex flex-col gap-1">
            <Field
              mode="edit"
              label={`${name} (${abbreviation})`}
              inputMode="numeric"
              inputClassName="w-[70px]"
              current={money[coin]}
              format={(amount) => amount.toLocaleString("en-US")}
              parse={parseCoins}
              schema={coinShape[coin].unwrap()}
              onSave={async (amount: number) => {
                await update.mutateAsync((latest) => ({
                  ...latest,
                  money: { ...latest.money, [coin]: amount },
                }));
              }}
            />
            <CoinAdjustment
              characterId={characterId}
              coin={coin}
              name={name}
              abbreviation={abbreviation}
              messages={messages}
            />
          </div>
        ))}
      </div>
      <div ref={setMessages} className="flex flex-col" />
    </Card>
  );
}
