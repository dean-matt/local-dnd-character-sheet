import { type CharacterRecord, type HouseRule, houseRule } from "@dnd/character";
import { useId } from "react";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { Card } from "../../Card.tsx";

type Edition = CharacterRecord["edition"];

/**
 * Every option the vocabulary holds, so one added there fails to compile until it is named
 * here. `editions` leaves out an edition where the option changes nothing.
 */
const OPTIONS: Record<HouseRule, { name: string; description: string; editions: Edition[] }> = {
  encumbrance: {
    name: "Encumbrance",
    description:
      "Carrying more than 5 times your Strength score in pounds costs 10 feet of speed. More than 10 times costs 20 feet and gives disadvantage on ability checks, attack rolls and saving throws that use Strength, Dexterity or Constitution.",
    editions: ["classic", "one"],
  },
  optionalClassFeatures: {
    name: "Optional class features",
    description:
      "Your classes also grant the optional features from Tasha's Cauldron of Everything, such as a fighter's Martial Versatility. Where one replaces a printed feature, both are listed.",
    editions: ["classic"],
  },
  customOrigin: {
    name: "Custom origin",
    description:
      "Your race's ability score increases keep their amounts, but each goes on any ability you choose.",
    editions: ["classic"],
  },
  duplicateSkillReplacement: {
    name: "Replace a duplicate skill",
    description:
      "Gaining a skill you already have from a second source lets you pick any other skill instead, as the 2014 rules do.",
    editions: ["one"],
  },
  duplicateToolReplacement: {
    name: "Replace a duplicate tool",
    description:
      "Gaining a tool you already have from a second source lets you pick any other tool instead, as the 2014 rules do.",
    editions: ["one"],
  },
  feats: {
    name: "Feats",
    description: "A feat may replace an Ability Score Improvement.",
    editions: ["classic"],
  },
};

const RULES = Object.keys(OPTIONS) as HouseRule[];

/**
 * The rules this character's table bends, one switch per option that changes something
 * under the character's edition. Each saves on change; one never set reads as the rule as
 * printed.
 */
export function HouseRulesCard({ character }: { character: CharacterRecord }) {
  const write = useHeldSave(character.id, "House rules");
  const hints = useId();
  const { definition } = character;
  return (
    <Card title="House rules">
      <ul className="flex flex-col gap-2">
        {RULES.filter((rule) => OPTIONS[rule].editions.includes(definition.edition)).map((rule) => (
          <li key={rule} className="flex flex-col">
            <label className="flex items-center gap-2 text-ink text-row">
              <input
                type="checkbox"
                checked={houseRule(definition, rule)}
                aria-describedby={`${hints}-${rule}`}
                onChange={(event) => {
                  const on = event.target.checked;
                  write(rule, (latest) => ({
                    ...latest,
                    houseRules: { ...latest.houseRules, [rule]: on },
                  }));
                }}
              />
              {OPTIONS[rule].name}
            </label>
            <span id={`${hints}-${rule}`} className="text-muted text-row">
              {OPTIONS[rule].description}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
