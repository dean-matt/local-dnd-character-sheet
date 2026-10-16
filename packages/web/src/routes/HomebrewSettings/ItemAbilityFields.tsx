import { ABILITIES, ABILITY_LABEL } from "@dnd/character";
import type { ReactNode } from "react";
import { InputField } from "../../components/InputField.tsx";
import { isRecord } from "../../lib/entryGuards.ts";
import { numberAt, recordAt, typedInteger, withField } from "./homebrewEntry.ts";
import { FORM_GRID, SHORT } from "./homebrewGrid.ts";

export interface ItemAbilityFieldsProps {
  /** The entry's `ability`: a bonus per ability, and the scores `static` sets. */
  ability: unknown;
  onChange: (next: Record<string, unknown> | undefined) => void;
  error?: ReactNode;
}

const orNothing = (record: Record<string, unknown>) =>
  Object.keys(record).length > 0 ? record : undefined;

/**
 * A bonus to each ability score and a score each one is set to. `max`, `choose` and any other
 * key a pasted entry carries survive an edit here.
 */
export function ItemAbilityFields({ ability, onChange, error }: ItemAbilityFieldsProps) {
  const grant = isRecord(ability) && !Array.isArray(ability) ? ability : {};
  const fixed = recordAt(grant, "static");
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-muted text-row">Ability scores</legend>
      {error && <p className="text-error text-row">{error}</p>}
      <div className={FORM_GRID}>
        {ABILITIES.map((key) => (
          <div key={key} className="contents">
            <div className={SHORT}>
              <InputField
                label={`${ABILITY_LABEL[key]} bonus`}
                type="number"
                step={1}
                value={numberAt(grant[key]) ?? ""}
                onChange={(event) =>
                  onChange(orNothing(withField(grant, key, typedInteger(event.target.value))))
                }
              />
            </div>
            <div className={SHORT}>
              <InputField
                label={`${ABILITY_LABEL[key]} set to`}
                type="number"
                min={0}
                max={30}
                step={1}
                value={numberAt(fixed[key]) ?? ""}
                onChange={(event) => {
                  const next = orNothing(withField(fixed, key, typedInteger(event.target.value)));
                  onChange(orNothing(withField(grant, "static", next)));
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
