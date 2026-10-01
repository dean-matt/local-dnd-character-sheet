import { type Derived, derivedValue } from "@dnd/character";
import { Popover } from "../../../Popover.tsx";
import { TermList } from "../../../TermList.tsx";
import { signed } from "../../signed.ts";

export function AttackBonus({ name, field }: { name: string; field: Derived<number> }) {
  const bonus = signed(derivedValue(field));
  return (
    <Popover trigger={bonus} triggerLabel={`${name} ${bonus}`} label={name}>
      <TermList terms={field.terms ?? []} />
    </Popover>
  );
}
