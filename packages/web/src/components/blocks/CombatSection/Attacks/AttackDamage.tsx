import { characterDerivedSchema } from "@dnd/character";
import { type ReactNode, useContext } from "react";
import { OverrideMark } from "../../../OverrideMark.tsx";
import { SaveOverride } from "../../../overrideContext.ts";
import { Popover } from "../../../Popover.tsx";
import type { Attack } from "../../attack.ts";
import { DerivedBreakdown } from "../../DerivedBreakdown.tsx";
import { signed } from "../../signed.ts";

const critSchema = characterDerivedSchema.shape.attacks.element.shape.critThreshold.shape.computed;

/**
 * A weapon's damage cell, opening the damage modifier's and the critical threshold's terms
 * and overrides. `overrideKey` is the weapon's own key, which each field's path extends.
 */
export function AttackDamage({
  name,
  attack,
  overrideKey,
  children,
}: {
  name: string;
  attack: Attack;
  overrideKey: string;
  children: ReactNode;
}) {
  const save = useContext(SaveOverride);
  const { damage, critThreshold } = attack;
  const fields = [critThreshold, ...(damage ? [damage.modifier] : [])];
  const explained = fields.some((field) => field.manual !== null || (field.terms ?? []).length > 0);
  const cell = (
    <>
      {children}
      {damage && damage.modifier.manual !== null && (
        <OverrideMark computed={`damage modifier ${signed(damage.modifier.computed)}`} />
      )}
      {critThreshold.manual !== null && (
        <OverrideMark computed={`critical hit on ${critThreshold.computed}`} />
      )}
    </>
  );
  if (!save && !explained) return cell;
  return (
    <Popover trigger={cell} label={`${name} damage breakdown`}>
      <div className="flex flex-col gap-2">
        {damage && (
          <section className="flex flex-col gap-1">
            <h4 className="font-semibold">Damage modifier</h4>
            <DerivedBreakdown
              name={`${name} damage modifier`}
              value={damage.modifier}
              format={signed}
              overrideKey={`${overrideKey}.damage.modifier`}
            />
          </section>
        )}
        <section className="flex flex-col gap-1">
          <h4 className="font-semibold">Critical hit on</h4>
          <DerivedBreakdown
            name={`${name} critical hit threshold`}
            value={critThreshold}
            format={String}
            overrideKey={`${overrideKey}.critThreshold`}
            schema={critSchema}
          />
        </section>
      </div>
    </Popover>
  );
}
