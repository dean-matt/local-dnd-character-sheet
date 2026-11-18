import { type CharacterRecord, type HouseRule, houseRule } from "@dnd/character";
import { useId, useState } from "react";
import { Card } from "../../components/Card.tsx";
import { useHeldSave } from "../../hooks/useHeldSave.ts";

type Edition = CharacterRecord["edition"];

type Outcome = { label: string; description: string };
type Choice = Outcome & { value: string | boolean };
type Option = { name: string; editions: Edition[] } & (
  | { printed: Outcome; house: Outcome }
  | { modes: [Choice, ...Choice[]] }
);

/** A boolean option's two outcomes, or a mode option's list with the rule as printed first. */
function choicesOf(option: Option): Choice[] {
  return "modes" in option
    ? option.modes
    : [
        { value: false, ...option.printed },
        { value: true, ...option.house },
      ];
}

/**
 * Every option the vocabulary holds, so one added there fails to compile until it is named
 * here. Each names both outcomes, the rule as printed first, since "off" alone never says
 * what the sheet does instead. `editions` leaves out an edition where the option changes
 * nothing.
 */
const OPTIONS: Record<HouseRule, Option> = {
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
  requireEquipProficiency: {
    name: "Equipping without proficiency",
    printed: {
      label: "Equip anything",
      description:
        "You can equip any weapon or armor. A weapon you lack proficiency with adds no proficiency bonus to its attacks. Armor you lack proficiency with, except a 2024 shield, gives disadvantage on Strength and Dexterity checks, saves and attack rolls, and you can't cast spells while wearing it.",
    },
    house: {
      label: "Proficiency required",
      description: "You can equip only the weapons and armor you're proficient with.",
    },
    editions: ["classic", "one"],
  },
  noInstantDeath: {
    name: "Massive damage",
    printed: {
      label: "Can kill outright",
      description:
        "If damage drops you to 0 hit points and the damage left over equals or exceeds your hit point maximum, you die. So does damage that large taken at 0.",
    },
    house: {
      label: "Never kills outright",
      description:
        "Massive damage takes you to 0 hit points or costs death saves, like any other hit.",
    },
    editions: ["classic", "one"],
  },
  everyHitDieOnLongRest: {
    name: "Hit dice on a long rest",
    printed: {
      label: "Half return",
      description:
        "A long rest returns up to half your total hit dice, rounded down and at least 1.",
    },
    house: {
      label: "All return",
      description: "A long rest returns every hit die you spent, as the 2024 rules do.",
    },
    editions: ["classic"],
  },
  waiveMaterialComponents: {
    name: "Material components",
    printed: {
      label: "Components as printed",
      description: "Casting a spell names the costly material component it consumes.",
    },
    house: {
      label: "Waive components",
      description: "Casting a spell ignores material components, so the dialog names none.",
    },
    editions: ["classic", "one"],
  },
  exhaustionAs2024: {
    name: "Exhaustion",
    printed: {
      label: "The 2014 table",
      description:
        "Each level adds a penalty: disadvantage on ability checks, halved speed, disadvantage on attack rolls and saves, a halved hit point maximum, then speed 0. Level 6 kills.",
    },
    house: {
      label: "The 2024 rule",
      description:
        "Each level takes 2 from every d20 Test and 5 feet from every speed. Level 6 kills.",
    },
    editions: ["classic"],
  },
  criticalHit: {
    name: "Critical hits",
    editions: ["classic", "one"],
    modes: [
      {
        value: "double",
        label: "Roll the dice twice",
        description:
          "A critical hit rolls the damage dice twice and adds the modifier once, for weapon and spell damage alike.",
      },
      {
        value: "maximum",
        label: "Maximum plus a roll",
        description:
          "A critical hit counts one set of the damage dice at its highest faces, rolls the other and adds the modifier once.",
      },
    ],
  },
  flanking: {
    name: "Flanking",
    editions: ["classic", "one"],
    modes: [
      {
        value: "none",
        label: "No flanking",
        description: "Position gives no bonus on a melee attack roll.",
      },
      {
        value: "advantage",
        label: "Advantage",
        description:
          "A melee attack roll offers a Flanking checkbox that gives advantage, netted with the advantage and disadvantage your conditions and effects impose.",
      },
      {
        value: "bonus",
        label: "+2 bonus",
        description:
          "A melee attack roll offers a Flanking checkbox that adds 2 to the roll and names it in the roll log.",
      },
    ],
  },
  naturalExtremes: {
    name: "Natural 20 and 1 on checks and saves",
    printed: {
      label: "The total decides",
      description:
        "An ability check or saving throw succeeds or fails by its total, whatever the d20 shows.",
    },
    house: {
      label: "Natural 20 and 1 decide",
      description:
        "A natural 20 on an ability check or saving throw succeeds and a natural 1 fails, whatever the total. The roll says so.",
    },
    editions: ["classic", "one"],
  },
  slowNaturalHealing: {
    name: "Natural healing on a long rest",
    printed: {
      label: "Full hit points",
      description: "A long rest restores all your hit points.",
    },
    house: {
      label: "Slow healing",
      description:
        "A long rest restores no hit points. Spend hit dice at the end of it to heal, as on a short rest.",
    },
    editions: ["classic", "one"],
  },
  minimumOneUse: {
    name: "Uses counted by a modifier",
    printed: {
      label: "No minimum",
      description:
        "A feature that prints no minimum, such as Divine Sense, gives no use when its count comes to 0 or less.",
    },
    house: {
      label: "At least one use",
      description:
        "Every feature that counts its uses by a modifier gives at least one, as Bardic Inspiration prints.",
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
  const [pending, setPending] = useState<Partial<Record<HouseRule, string | boolean>>>({});
  const { definition } = character;

  const choose = (rule: HouseRule, on: string | boolean) => {
    setPending((current) => ({ ...current, [rule]: on }));
    write(rule, (latest) => ({
      ...latest,
      houseRules: { ...latest.houseRules, [rule]: on } as typeof latest.houseRules,
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
          const choices = choicesOf(option);
          const on = pending[rule] ?? houseRule(definition, rule);
          const shown = choices.find(({ value }) => value === on) ?? choices[0];
          const hint = `${ids}-${rule}`;
          return (
            <fieldset key={rule} aria-describedby={hint} className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-1.5 p-0 font-semibold text-ink text-row">{option.name}</legend>
              <div className="flex gap-1.5 rounded-card bg-subtle p-1">
                {choices.map(({ value, label }, index) => (
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
                    <span className="font-semibold text-row">{label}</span>
                    {index === 0 && (
                      <>
                        {/* Separates the tag from the label in the radio's accessible name. */}{" "}
                        <span className="text-label">As printed</span>
                      </>
                    )}
                  </label>
                ))}
              </div>
              <p id={hint} className="mt-1.5 text-muted text-row">
                {shown?.description}
              </p>
            </fieldset>
          );
        })}
      </div>
    </Card>
  );
}
