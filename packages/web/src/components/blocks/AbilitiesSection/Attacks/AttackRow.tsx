import type { ReactNode } from "react";

const CELL = "px-0.5 py-1.5 text-left align-top";

export function AttackRow({
  name,
  bonus,
  damage,
}: {
  name: string;
  bonus: ReactNode;
  damage: ReactNode;
}) {
  return (
    <tr className="border-border border-t">
      <th scope="row" className={`${CELL} truncate font-normal`}>
        {name}
      </th>
      <td className={`${CELL} font-semibold`}>{bonus}</td>
      <td className={`${CELL} text-muted`}>{damage}</td>
    </tr>
  );
}
