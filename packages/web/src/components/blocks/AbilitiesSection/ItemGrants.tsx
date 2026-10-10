import { type CharacterDerived, derivedValue } from "@dnd/character";
import { Card } from "../../Card.tsx";

/**
 * The equipped items that grant a proficiency or a language. Upstream flags the grant
 * without naming what it grants, so the card names the item and leaves the rest to its
 * rules text.
 */
export function ItemGrants({ derived }: { derived: CharacterDerived }) {
  const { proficiencies, languages } = derivedValue(derived.itemGrants);
  if (proficiencies.length + languages.length === 0) return null;
  const rows = [
    ["Proficiency", proficiencies],
    ["Language", languages],
  ] as const;
  return (
    <Card title="Granted by items">
      <dl className="flex flex-col gap-1 text-body">
        {rows.map(([kind, items]) =>
          items.length === 0 ? null : (
            <div key={kind} className="flex gap-2">
              <dt className="text-muted">{kind}</dt>
              <dd>{items.join(", ")}</dd>
            </div>
          ),
        )}
      </dl>
    </Card>
  );
}
