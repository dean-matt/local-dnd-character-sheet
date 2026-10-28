import { isRecord } from "../../lib/entryGuards.ts";
import { MultiSelect } from "../MultiSelect.tsx";
import { SKILL_NAMES } from "./homebrewVocabulary.ts";

const OPTIONS = SKILL_NAMES.map((name) => ({ value: name.toLowerCase(), label: name }));

/** The skills a list names, `undefined` for a list of alternatives or a pick, which a name list cannot show. */
function namesIn(list: unknown): string[] | undefined {
  if (list === undefined) return [];
  if (!Array.isArray(list) || list.length > 1) return undefined;
  const [only] = list;
  if (only === undefined) return [];
  return isRecord(only) && Object.values(only).every((value) => value === true)
    ? Object.keys(only)
    : undefined;
}

/**
 * The skills an item grants proficiency or expertise in, written as `skillProficiencies` and
 * `expertise` hold them: a list of one object keyed by skill. A list of alternatives or a
 * pick stays in the JSON.
 */
export function ItemSkillFields({
  proficiencies,
  expertise,
  onChange,
}: {
  proficiencies: unknown;
  expertise: unknown;
  onChange: (key: "skillProficiencies" | "expertise", next: unknown[] | undefined) => void;
}) {
  const field = (key: "skillProficiencies" | "expertise", label: string, held: unknown) => {
    const names = namesIn(held);
    if (names === undefined) {
      return (
        <p className="text-muted text-row">
          This item states its {label.toLowerCase()} as alternatives or a pick. Edit them in JSON.
        </p>
      );
    }
    return (
      <MultiSelect
        inForm
        label={label}
        noun="skills"
        options={OPTIONS}
        selected={names}
        onChange={(chosen) =>
          onChange(
            key,
            chosen.length > 0
              ? [Object.fromEntries(chosen.map((name) => [name, true]))]
              : undefined,
          )
        }
      />
    );
  };
  return (
    <div className="flex flex-col gap-2">
      {field("skillProficiencies", "Skill proficiencies", proficiencies)}
      {field("expertise", "Skill expertise", expertise)}
    </div>
  );
}
