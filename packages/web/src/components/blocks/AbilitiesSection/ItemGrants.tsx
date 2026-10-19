import { type CharacterDerived, derivedValue } from "@dnd/character";
import { Card } from "../../Card.tsx";

/**
 * The equipped items that grant a skill, a proficiency or a language. A skill is named with
 * the items behind it. Upstream flags another proficiency or a language without naming what
 * it grants, so the card names the item and leaves the rest to its rules text.
 */
export function ItemGrants({ derived }: { derived: CharacterDerived }) {
  const { skills, proficiencies, languages } = derivedValue(derived.itemGrants);
  if (skills.length + proficiencies.length + languages.length === 0) return null;
  const skilled = (level: "proficient" | "expertise") =>
    skills
      .filter((skill) => skill.level === level)
      .map((skill) => `${skill.ref.name} (${skill.from.join(", ")})`);
  const rows = [
    ["Skill", skilled("proficient")],
    ["Expertise", skilled("expertise")],
    ["Proficiency", proficiencies],
    ["Language", languages],
  ] as const;
  return (
    <Card title="Granted by items">
      <dl className="flex flex-col gap-0.5 text-body">
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
