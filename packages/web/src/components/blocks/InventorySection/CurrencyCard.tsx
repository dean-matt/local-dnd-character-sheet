import type { CharacterDefinition } from "@dnd/character";
import { Card } from "../../Card.tsx";

const COINS = [
  ["platinum", "Platinum (pp)"],
  ["gold", "Gold (gp)"],
  ["electrum", "Electrum (ep)"],
  ["silver", "Silver (sp)"],
  ["copper", "Copper (cp)"],
] as const;

export function CurrencyCard({ money }: { money: CharacterDefinition["money"] }) {
  return (
    <Card title="Currency">
      <dl className="flex flex-wrap items-end gap-x-5 gap-y-3">
        {COINS.map(([coin, label]) => (
          <div key={coin}>
            <dt className="mb-1 font-semibold text-[10px] text-muted uppercase tracking-[0.06em]">
              {label}
            </dt>
            <dd className="min-w-[70px] rounded-control border border-border bg-subtle px-2 py-1.5 text-body">
              {money[coin].toLocaleString("en-US")}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
