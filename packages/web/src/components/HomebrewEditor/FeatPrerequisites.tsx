import { ABILITIES, ABILITY_LABEL, type Ability } from "@dnd/character";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { useFeats } from "../../hooks/useFeats.ts";
import { isRecord } from "../../lib/entryGuards.ts";
import { titleCase } from "../../lib/proficiencyGrants.ts";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { MultiSelect } from "../MultiSelect.tsx";
import { Select } from "../Select.tsx";
import {
  featsOf,
  hasUnshownParts,
  levelOf,
  proficienciesOf,
  proficiencyEntry,
  racesOf,
  scoresOf,
  spellcastingOf,
} from "./featPrerequisiteShapes.ts";
import { HomebrewCheckbox } from "./HomebrewCheckbox.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { type HomebrewFormProps, listAt, typedInteger, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT, WHOLE } from "./homebrewGrid.ts";
import { ROW, ROW_BUTTON } from "./homebrewRows.ts";

type Option = { value: string; label: string };
type Alternative = Record<string, unknown>;

const ALTERNATIVE = "flex min-w-0 flex-col gap-3 rounded-control border border-border p-3";

const ABILITY_OPTIONS = ABILITIES.map((value) => ({ value, label: ABILITY_LABEL[value] }));

const PROFICIENCY_OPTIONS = [
  { value: "armor:light", label: "Light armor" },
  { value: "armor:medium", label: "Medium armor" },
  { value: "armor:heavy", label: "Heavy armor" },
  { value: "armor:shield", label: "Shields" },
  { value: "weapon:simple", label: "Simple weapons" },
  { value: "weapon:martial", label: "Martial weapons" },
];

/** `options` with each of `values` they lack listed under its own spelling. */
const withValues = (options: Option[], values: string[]): Option[] => [
  ...options,
  ...values
    .filter((value) => !options.some((option) => option.value === value))
    .map((value) => ({ value, label: titleCase(value.split("|")[0] ?? value) })),
];

/** A list part written back: `undefined` where nothing is left, so the key drops. */
const listed = <T,>(values: T[]): T[] | undefined => (values.length > 0 ? values : undefined);

/**
 * A homebrew feat's prerequisites as alternatives, any one of which qualifies, each needing
 * everything it sets: a character level, ability score minimums, a race, an armor or weapon
 * proficiency, another feat, or the ability to cast a spell, the lists any one of their
 * names sufficing. The races and feats are the edition's, loaded as the step opens. A part
 * stated in a shape the form cannot show, and every key it has no control for, stays as
 * written and is noted, to edit in JSON.
 */
export function FeatPrerequisites({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const races = useCatalogSearch({ edition, type: "race", query: "", limit: 200, listAll: true });
  const feats = useFeats(edition);
  const raceOptions: Option[] = [];
  for (const { name } of races.data?.items ?? []) {
    const value = name.toLowerCase();
    if (!raceOptions.some((option) => option.value === value)) {
      raceOptions.push({ value, label: name });
    }
  }
  const featOptions = (feats.data?.items ?? []).map(({ name, source }) => ({
    value: `${name}|${source}`.toLowerCase(),
    label: `${name} (${source})`,
  }));
  const alternatives = listAt(entry, "prerequisite");
  const write = (next: unknown[]) => onChange(withField(entry, "prerequisite", listed(next)));
  const replace = (at: number, key: string, value: unknown) =>
    write(
      alternatives.map((alternative, index) =>
        index === at && isRecord(alternative) ? withField(alternative, key, value) : alternative,
      ),
    );
  const error = errorFor("prerequisite");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-row">
        A character meeting any one prerequisite may take the feat. None leaves it open to all.
      </p>
      {alternatives.map((alternative, at) => {
        const position = at + 1;
        const parts: Alternative = isRecord(alternative) ? alternative : {};
        const level = levelOf(parts);
        const scores = scoresOf(parts);
        const raceNames = racesOf(parts);
        const proficiencies = proficienciesOf(parts);
        const featNames = featsOf(parts);
        const spellcasting = spellcastingOf(parts);
        const set = (key: string, value: unknown) => replace(at, key, value);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: an alternative has no id, and the list only grows or shrinks at one the user picked.
          <fieldset key={at} className={ALTERNATIVE}>
            <legend className="px-1 font-semibold text-row">Prerequisite {position}</legend>
            <div className={FORM_GRID}>
              {level !== undefined && (
                <div className={SHORT}>
                  <InputField
                    label="Character level"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={level ?? ""}
                    onChange={(event) => set("level", typedInteger(event.target.value))}
                  />
                </div>
              )}
              {raceNames !== undefined && (
                <div className={PAIRED}>
                  <MultiSelect
                    inForm
                    label="Race"
                    noun="races"
                    options={withValues(raceOptions, raceNames)}
                    selected={raceNames}
                    onChange={(next) => set("race", listed(next.map((name) => ({ name }))))}
                  />
                </div>
              )}
              {proficiencies !== undefined && (
                <div className={PAIRED}>
                  <MultiSelect
                    inForm
                    label="Armor or weapon proficiency"
                    noun="proficiencies"
                    options={withValues(PROFICIENCY_OPTIONS, proficiencies)}
                    selected={proficiencies}
                    onChange={(next) => set("proficiency", listed(next.map(proficiencyEntry)))}
                  />
                </div>
              )}
              {featNames !== undefined && (
                <div className={PAIRED}>
                  <MultiSelect
                    inForm
                    label="Feat"
                    noun="feats"
                    options={withValues(featOptions, featNames)}
                    selected={featNames}
                    onChange={(next) => set("feat", listed(next))}
                  />
                </div>
              )}
              {spellcasting !== undefined && (
                <div className={`${WHOLE} flex items-end`}>
                  <HomebrewCheckbox
                    label="Can cast at least one spell"
                    checked={spellcasting}
                    onChange={(checked) => set("spellcasting", checked || undefined)}
                  />
                </div>
              )}
            </div>
            {scores !== undefined && (
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="mb-1 text-muted text-row">
                  Ability score minimums, any one sufficing
                </legend>
                {scores.map((score, index) => {
                  const rewrite = (change: Partial<typeof score>) =>
                    set(
                      "ability",
                      scores.map((each, row) => {
                        const { ability, minimum } = row === index ? { ...each, ...change } : each;
                        return { [ability]: minimum };
                      }),
                    );
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a row has no id, and the list only grows or shrinks at a row the user picked.
                    <div key={index} className={ROW}>
                      <FormField label="Ability">
                        {(control) => (
                          <Select
                            {...control}
                            options={ABILITY_OPTIONS}
                            value={score.ability}
                            onChange={(next) => rewrite({ ability: next as Ability })}
                          />
                        )}
                      </FormField>
                      <InputField
                        label="Minimum score"
                        type="number"
                        min={1}
                        max={30}
                        step={1}
                        value={score.minimum ?? ""}
                        onChange={(event) =>
                          rewrite({ minimum: typedInteger(event.target.value) ?? null })
                        }
                      />
                      <HomebrewRowRemove
                        name={`prerequisite ${position} score minimum ${index + 1}`}
                        onRemove={() =>
                          set(
                            "ability",
                            listed(
                              scores
                                .filter((_, row) => row !== index)
                                .map(({ ability, minimum }) => ({ [ability]: minimum })),
                            ),
                          )
                        }
                      />
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    set("ability", [
                      ...scores.map(({ ability, minimum }) => ({ [ability]: minimum })),
                      { str: 13 },
                    ])
                  }
                  className={`self-start ${ROW_BUTTON}`}
                >
                  Add a score minimum
                </button>
              </fieldset>
            )}
            {hasUnshownParts(parts) && (
              <p className="text-muted text-row">
                Part of this prerequisite is stated in a way the form cannot show. Edit it in JSON.
              </p>
            )}
            <button
              type="button"
              onClick={() => write(alternatives.filter((_, index) => index !== at))}
              className={`self-start ${ROW_BUTTON}`}
            >
              Remove prerequisite {position}
            </button>
          </fieldset>
        );
      })}
      <button
        type="button"
        onClick={() => write([...alternatives, {}])}
        className={`self-start ${ROW_BUTTON}`}
      >
        {alternatives.length === 0 ? "Add a prerequisite" : "Add an alternative"}
      </button>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </div>
  );
}
