import type { RollEffectEntry } from "@dnd/character";
import type { ReactNode } from "react";
import { RollEffects } from "../RollEffects.tsx";

const CELL = "px-0.5 py-1.5 text-left align-top";

export function AttackRow({
  name,
  bonus,
  damage,
  effects,
  notes,
}: {
  name: string;
  bonus: ReactNode;
  damage: ReactNode;
  effects: readonly RollEffectEntry[];
  notes?: ReactNode;
}) {
  return (
    <tr className="border-border border-t">
      <th scope="row" className={`${CELL} font-normal`}>
        <div className="truncate">{name}</div>
        {notes}
        <RollEffects effects={effects} />
      </th>
      <td className={`${CELL} font-semibold`}>{bonus}</td>
      <td className={`${CELL} text-muted`}>{damage}</td>
    </tr>
  );
}
