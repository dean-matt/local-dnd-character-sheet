import { type CharacterRecord, type HouseRule, houseRule } from "@dnd/character";
import { useId, useState } from "react";
import { Card } from "../../components/Card.tsx";
import { useHeldSave } from "../../hooks/useHeldSave.ts";

type Edition = CharacterRecord["edition"];

type Outcome = { label: string; description: string };

/**
 * Every option the vocabulary holds, so one added there fails to compile until it is named
 * here. Each names both outcomes, the rule as printed first, since "off" alone never says
 * what the sheet does instead. `editions` leaves out an edition where the option changes
 * nothing.
 */
const OPTIONS: Record<
  HouseRule,
  { name: string; printed: Outcome; house: Outcome; editions: Edition[] }
> = {
  encumbrance: {
    name: "Encumbrance",
    printed: {
      label: "Weight only caps carrying",
      description:
        "You can carry up to your carrying capacity, and the load never costs speed or gives disadvantage.",
    },
    house: {
      label: "Heavy loads slow you",
      description:
        "Carrying more than 5 times your Strength score in pounds costs 10 feet of speed. More than 10 times costs 20 feet and gives disadvantage on Strength, Dexterity and Constitution checks, saves and attack rolls. A Tiny creature reaches both sooner.",
    },
    editions: ["classic", "one"],
  },
  optionalClassFeatures: {
    name: "Optional class features",
    printed: {
      label: "Printed features only",
      description: "Your classes grant only the features their own tables print.",
    },
    house: {
      label: "Add Tasha's options",
      description:
        "Your classes also grant the optional features from Tasha's Cauldron of Everything, such as a fighter's Martial Versatility. Where one replaces a printed feature, both are listed.",
    },
    editions: ["classic"],
  },
  customOrigin: {
    name: "Custom origin",
    printed: {
      label: "Increases as the race prints",
      description: "Your race's ability score increases go on the abilities the race names.",
    },
    house: {
      label: "Place increases freely",
      description:
        "Your race's ability score increases keep their amounts, but each goes on any ability you choose.",
    },
    editions: ["classic"],
  },
  duplicateSkillReplacement: {
    name: "Replace a duplicate skill",
    printed: {
      label: "Second source gives nothing",
      description:
        "Gaining a skill you already have from a second source gives nothing in its place.",
    },
    house: {
      label: "Pick another skill",
      description:
        "Gaining a skill you already have from a second source lets you pick any other skill instead, as the 2014 rules do.",
    },
    editions: ["one"],
  },
  duplicateToolReplacement: {
    name: "Replace a duplicate tool",
    printed: {
      label: "Second source gives nothing",
      description:
        "Gaining a tool you already have from a second source gives nothing in its place.",
    },
    house: {
      label: "Pick another tool",
      description:
        "Gaining a tool you already have from a second source lets you pick any other tool instead, as the 2014 rules do.",
    },
    editions: ["one"],
  },
  feats: {
    name: "Feats",
    printed: {
      label: "Scores only",
      description: "Each Ability Score Improvement raises your ability scores.",
    },
    house: {
      label: "Feat or scores",
      description: "A feat may replace an Ability Score Improvement.",
    },
    editions: ["classic"],
  },
};

const RULES = Object.keys(OPTIONS) as HouseRule[];

/**
 * The rules this character's table bends: per option that changes something under the
 * character's edition, a pair of radios naming the printed outcome and the house rule's,
 * with the chosen one described beneath. Each saves on change; one never set reads as the
 * rule as printed. A choice shows while its write is in flight, and the stored one once the
 * write settles, so a failed save puts it back.
 */
export function HouseRulesCard({ character }: { character: CharacterRecord }) {
  const write = useHeldSave(character.id, "House rules");
  const ids = useId();
  const [pending, setPending] = useState<Partial<Record<HouseRule, boolean>>>({});
  const { definition } = character;

  const choose = (rule: HouseRule, on: boolean) => {
    setPending((current) => ({ ...current, [rule]: on }));
    write(rule, (latest) => ({
      ...latest,
      houseRules: { ...latest.houseRules, [rule]: on },
    })).then(() =>
      // A later click still in flight keeps its own state.
      setPending(({ [rule]: shown, ...rest }) =>
        shown === on ? rest : { ...rest, [rule]: shown },
      ),
    );
  };

  return (
    <Card title="House rules">
      <div className="flex flex-col gap-4">
        {RULES.filter((rule) => OPTIONS[rule].editions.includes(definition.edition)).map((rule) => {
          const option = OPTIONS[rule];
          const on = pending[rule] ?? houseRule(definition, rule);
          const hint = `${ids}-${rule}`;
          return (
            <fieldset key={rule} aria-describedby={hint} className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-1.5 p-0 font-semibold text-ink text-row">{option.name}</legend>
              <div className="flex gap-1.5 rounded-card bg-subtle p-1">
                {[false, true].map((value) => (
                  <label
                    key={String(value)}
                    className="flex flex-1 cursor-pointer flex-col items-center rounded-control px-2 py-1.5 text-center text-muted has-checked:bg-surface has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
                  >
                    <input
                      type="radio"
                      name={hint}
                      checked={on === value}
                      onChange={() => choose(rule, value)}
                      className="sr-only"
                    />
                    <span className="font-semibold text-row">
                      {(value ? option.house : option.printed).label}
                    </span>
                    {!value && (
                      <>
                        {/* Separates the tag from the label in the radio's accessible name. */}{" "}
                        <span className="text-label">As printed</span>
                      </>
                    )}
                  </label>
                ))}
              </div>
              <p id={hint} className="mt-1.5 text-muted text-row">
                {(on ? option.house : option.printed).description}
              </p>
            </fieldset>
          );
        })}
      </div>
    </Card>
  );
}
