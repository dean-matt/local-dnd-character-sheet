import type { RollEffectEntry } from "@dnd/character";
import type { ReactNode } from "react";
import { RollEffectChip } from "../RollEffectChip.tsx";

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
      </th>
      <td className={`${CELL} font-semibold`}>
        <span className="flex items-center gap-1">
          {bonus}
          <RollEffectChip roll={name} effects={effects} />
        </span>
      </td>
      <td className={`${CELL} text-muted`}>{damage}</td>
    </tr>
  );
}
