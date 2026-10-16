import { ABILITY_LABEL, type CharacterDerived, derivedValue } from "@dnd/character";
import { titleCase } from "../../../lib/proficiencyGrants.ts";
import { Card } from "../../Card.tsx";

const cited = ({ name, from }: { name: string; from: readonly string[] }) =>
  `${name} (${from.join(", ")})`;

/**
 * What feats grant beside what the definition stores, each named with the feats behind it.
 * The saves and skills above already count them; this says where they came from.
 */
export function FeatGrants({ derived }: { derived: CharacterDerived }) {
  const { savingThrows, skills, tools, languages, armor, weapons } = derivedValue(
    derived.featGrants,
  );
  const named = (list: readonly { name: string; from: readonly string[] }[]) =>
    list.map((grant) => cited({ ...grant, name: titleCase(grant.name) }));
  const skilled = (level: "proficient" | "expertise") =>
    skills
      .filter((skill) => skill.level === level)
      .map((skill) => cited({ name: skill.ref.name, from: skill.from }));
  const rows = [
    [
      "Saving throw",
      savingThrows.map((save) => cited({ ...save, name: ABILITY_LABEL[save.name] })),
    ],
    ["Skill", skilled("proficient")],
    ["Expertise", skilled("expertise")],
    ["Tool", named(tools)],
    ["Language", named(languages)],
    ["Armor", named(armor)],
    ["Weapon", named(weapons)],
  ] as const;
  if (rows.every(([, grants]) => grants.length === 0)) return null;
  return (
    <Card title="Granted by feats">
      <dl className="flex flex-col gap-0.5 text-body">
        {rows.map(([kind, grants]) =>
          grants.length === 0 ? null : (
            <div key={kind} className="flex gap-2">
              <dt className="text-muted">{kind}</dt>
              <dd>{grants.join(", ")}</dd>
            </div>
          ),
        )}
      </dl>
    </Card>
  );
}
