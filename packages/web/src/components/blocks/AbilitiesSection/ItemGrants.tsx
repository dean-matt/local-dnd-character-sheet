import { type CharacterDerived, derivedValue } from "@dnd/character";
import { Card } from "../../Card.tsx";

/**
 * What equipped items grant: a skill, a proficiency or a language, each with the item behind
 * it. Upstream flags a proficiency or a language without naming it, so an item whose pick
 * is not stored yet appears as waiting on a choice.
 */
export function ItemGrants({ derived }: { derived: CharacterDerived }) {
  const { skills, proficiencies, languages, pending } = derivedValue(derived.itemGrants);
  if (skills.length + proficiencies.length + languages.length + pending.length === 0) return null;
  const skilled = (level: "proficient" | "expertise") =>
    skills
      .filter((skill) => skill.level === level)
      .map((skill) => `${skill.ref.name} (${skill.from.join(", ")})`);
  const rows = [
    ["Skill", skilled("proficient")],
    ["Expertise", skilled("expertise")],
    ["Proficiency", proficiencies.map(({ name, from }) => `${name} (${from})`)],
    ["Language", languages.map(({ name, from }) => `${name} (${from})`)],
    ["Waiting on a choice", pending.map(({ item, kind }) => `${item} (${kind})`)],
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
