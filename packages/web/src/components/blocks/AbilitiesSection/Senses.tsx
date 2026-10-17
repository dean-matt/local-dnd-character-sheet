import { type CharacterDerived, derivedValue } from "@dnd/character";
import { titleCase } from "../../../lib/proficiencyGrants.ts";
import { Card } from "../../Card.tsx";

/** Each sense the character has, its range in feet and the race, feats or items that grant it. */
export function Senses({ derived }: { derived: CharacterDerived }) {
  const senses = derivedValue(derived.senses);
  if (senses.length === 0) return null;
  return (
    <Card title="Senses">
      <dl className="flex flex-col gap-0.5 text-body">
        {senses.map(({ name, range, from }) => (
          <div key={name} className="flex gap-2">
            <dt className="text-muted">{titleCase(name)}</dt>
            <dd>
              {range} ft. ({from.join(", ")})
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
