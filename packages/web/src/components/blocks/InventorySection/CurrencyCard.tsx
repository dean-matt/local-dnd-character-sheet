import type { CharacterDefinition } from "@dnd/character";
import { Info } from "lucide-react";
import { useId, useState } from "react";
import { Card } from "../../Card.tsx";
import { Popover } from "../../Popover.tsx";
import { CoinField } from "./CoinField.tsx";

const COINS = [
  ["platinum", "Platinum", "pp"],
  ["gold", "Gold", "gp"],
  ["electrum", "Electrum", "ep"],
  ["silver", "Silver", "sp"],
  ["copper", "Copper", "cp"],
] as const;

const HINT = "Type a total, or a sum for one such as 20+10 or 100-37.";

export function CurrencyCard({
  characterId,
  money,
}: {
  characterId: string;
  money: CharacterDefinition["money"];
}) {
  // A column is too narrow for a sentence, so every coin's message lands under the row.
  const [messages, setMessages] = useState<HTMLDivElement | null>(null);
  const hintId = useId();
  return (
    <Card
      title="Currency"
      aside={
        <Popover
          trigger={<Info aria-hidden="true" size={14} className="block text-muted" />}
          triggerLabel="How to enter coins"
          label="How to enter coins"
        >
          {HINT}
        </Popover>
      }
    >
      {/* The popover's text mounts only while open, so the fields take their description from here. */}
      <span id={hintId} hidden>
        {HINT}
      </span>
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
            hintId={hintId}
            messages={messages}
          />
        ))}
      </div>
      <div ref={setMessages} className="flex flex-col" />
    </Card>
  );
}
