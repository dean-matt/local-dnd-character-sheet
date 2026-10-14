/**
 * The Resistances & Immunities card: what the race and the equipped items grant, read off
 * the derived block, then what the player added by hand from the definition. A granted chip
 * opens a modal naming every source that grants it; an added one carries × instead.
 */
import {
  type CharacterDefinition,
  type CharacterDerived,
  type CharacterRecord,
  derivedValue,
} from "@dnd/character";
import { useHeldWrites } from "../../../../hooks/useHeldWrites.ts";
import { useSaveToast } from "../../../../hooks/useSaveToast.ts";
import { useUpdateCharacterDefinition } from "../../../../hooks/useUpdateCharacterDefinition.ts";
import { CONDITIONS, DAMAGE_TYPE_NAMES } from "../../../../lib/defenseVocabulary.ts";
import { AddChoice } from "../../../AddChoice.tsx";
import { Card } from "../../../Card.tsx";
import { capitalize } from "../../capitalize.ts";
import { DefenseChipRow, type DefenseChipRowProps } from "./DefenseChipRow.tsx";

type Defense = CharacterDerived["defenses"]["computed"]["resistances"][number];

type Chip = DefenseChipRowProps["items"][number];

type AddedKind = keyof CharacterDefinition["addedDefenses"];

const TITLE = "Resistances & Immunities";

const options = new Intl.ListFormat("en", { type: "disjunction" });

function chips(defenses: readonly Defense[], kind: string, effect: (name: string) => string) {
  return defenses.map(({ name, from }): Chip => {
    const label = capitalize(name);
    return { label, title: `${label} ${kind}`, effect: effect(name), from };
  });
}

export function Defenses({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const update = useUpdateCharacterDefinition(character.id);
  const writes = useHeldWrites(update);
  const failure = writes.latest?.error;
  useSaveToast(
    TITLE,
    failure ? `Couldn't save: ${failure.message}` : undefined,
    writes.retry,
    failure,
  );
  const { resistances, damageImmunities, conditionImmunities, vulnerabilities, resistanceChoice } =
    derivedValue(derived.defenses);
  const added = character.definition.addedDefenses;

  const edit = (kind: AddedKind, name: string, keep: boolean) =>
    writes.write(`${kind}|${name}`, (latest) => {
      const others = latest.addedDefenses[kind].filter((each) => each !== name);
      return {
        ...latest,
        addedDefenses: { ...latest.addedDefenses, [kind]: keep ? [...others, name] : others },
      };
    });
  const addedChips = (kind: AddedKind, noun: string) =>
    added[kind].map((name) => ({
      key: `${kind}|${name}`,
      label: capitalize(name),
      name: `${capitalize(name)} ${noun}`,
    }));
  const remove = (key: string) => {
    const at = key.indexOf("|");
    edit(key.slice(0, at) as AddedKind, key.slice(at + 1), false);
  };
  const adder = (kind: AddedKind, label: string, vocabulary: typeof CONDITIONS) => (
    <AddChoice
      label={label}
      options={vocabulary.filter(({ value }) => !added[kind].includes(value))}
      onAdd={(name) => edit(kind, name, true)}
    />
  );

  return (
    <Card title={TITLE}>
      <div className="flex flex-col gap-2">
        <DefenseChipRow
          heading="Resistances"
          items={chips(
            resistances,
            "Resistance",
            (name) => `You take half ${name} damage, rounded down.`,
          )}
          added={addedChips("resistances", "resistance")}
          onRemove={remove}
          note={
            resistanceChoice
              ? `${resistanceChoice.from} offers ${options.format(resistanceChoice.options)}, not yet chosen.`
              : undefined
          }
        >
          {adder("resistances", "Add resistance", DAMAGE_TYPE_NAMES)}
        </DefenseChipRow>
        <DefenseChipRow
          heading="Immunities"
          items={[
            ...chips(damageImmunities, "Immunity", (name) => `You take no ${name} damage.`),
            ...chips(
              conditionImmunities,
              "Immunity",
              (name) => `${capitalize(name)} can't affect you.`,
            ),
          ]}
          added={[
            ...addedChips("damageImmunities", "immunity"),
            ...addedChips("conditionImmunities", "immunity"),
          ]}
          onRemove={remove}
        >
          {adder("damageImmunities", "Add damage immunity", DAMAGE_TYPE_NAMES)}
          {adder("conditionImmunities", "Add condition immunity", CONDITIONS)}
        </DefenseChipRow>
        {vulnerabilities.length > 0 && (
          <DefenseChipRow
            heading="Vulnerabilities"
            items={chips(
              vulnerabilities,
              "Vulnerability",
              (name) => `You take double ${name} damage.`,
            )}
          />
        )}
      </div>
    </Card>
  );
}
