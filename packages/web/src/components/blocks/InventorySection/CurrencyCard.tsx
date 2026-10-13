import type { CharacterDefinition } from "@dnd/character";
import { useState } from "react";
import { Card } from "../../Card.tsx";
import { CoinField } from "./CoinField.tsx";

const COINS = [
  ["platinum", "Platinum", "pp"],
  ["gold", "Gold", "gp"],
  ["electrum", "Electrum", "ep"],
  ["silver", "Silver", "sp"],
  ["copper", "Copper", "cp"],
] as const;

const HINT = "Type a total, or an amount such as +25 or -37.";

export function CurrencyCard({
  characterId,
  money,
}: {
  characterId: string;
  money: CharacterDefinition["money"];
}) {
  // A column is too narrow for a sentence, so every coin's message lands under the row.
  const [messages, setMessages] = useState<HTMLDivElement | null>(null);
  return (
    <Card title="Currency">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
        {COINS.map(([coin, name, abbreviation]) => (
          <CoinField
            key={coin}
            characterId={characterId}
            coin={coin}
            name={name}
            abbreviation={abbreviation}
            total={money[coin]}
            hint={HINT}
            messages={messages}
          />
        ))}
      </div>
      <p className="mt-2 text-muted text-row">{HINT}</p>
      <div ref={setMessages} className="flex flex-col" />
    </Card>
  );
}
