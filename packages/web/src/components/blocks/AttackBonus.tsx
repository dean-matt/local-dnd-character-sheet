import { type Derived, derivedValue } from "@dnd/character";
import { signed } from "../../lib/signed.ts";
import { Popover } from "../Popover.tsx";
import { TermList } from "../TermList.tsx";

export function AttackBonus({ name, field }: { name: string; field: Derived<number> }) {
  const bonus = signed(derivedValue(field));
  return (
    <Popover trigger={bonus} triggerLabel={`${name} ${bonus}`} label={name}>
      <TermList terms={field.terms ?? []} />
    </Popover>
  );
}
