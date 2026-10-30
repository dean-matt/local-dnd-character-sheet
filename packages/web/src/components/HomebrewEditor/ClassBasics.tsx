import { ABILITIES } from "@dnd/character";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { MultiSelect } from "../MultiSelect.tsx";
import { Select } from "../Select.tsx";
import { readPrimaryAbility, writePrimaryAbility } from "./classShapes.ts";
import { type HomebrewFormProps, listAt, recordAt, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT, WHOLE } from "./homebrewGrid.ts";
import { ABILITY_OPTIONS, withCurrent } from "./homebrewOptions.ts";

const HIT_DICE = [6, 8, 10, 12].map((faces) => ({ value: String(faces), label: `d${faces}` }));

const NEEDS = [
  { value: "any", label: "Any one of them" },
  { value: "all", label: "All of them" },
];

/** A homebrew class's name, hit die, saving throws and primary ability. */
export function ClassBasics({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const faces = String(recordAt(entry, "hd").faces ?? "");
  const saves = listAt(entry, "proficiency").filter(
    (ability): ability is string => typeof ability === "string",
  );
  const primary = readPrimaryAbility(entry.primaryAbility);
  return (
    <div className={FORM_GRID}>
      <div className={PAIRED}>
        <InputField
          label="Name"
          value={textAt(entry, "name")}
          onChange={(event) => set("name", event.target.value)}
          error={errorFor("name")}
        />
      </div>
      <div className={SHORT}>
        <FormField label="Hit die" error={errorFor("hd")}>
          {(control) => (
            <Select
              {...control}
              options={faces ? withCurrent(HIT_DICE, faces) : HIT_DICE}
              value={faces}
              onChange={(next) =>
                set("hd", { ...recordAt(entry, "hd"), number: 1, faces: Number(next) })
              }
            />
          )}
        </FormField>
      </div>
      <div className={PAIRED}>
        <MultiSelect
          inForm
          label="Saving throws"
          noun="abilities"
          options={ABILITY_OPTIONS}
          selected={saves}
          onChange={(next) =>
            set(
              "proficiency",
              next.length > 0 ? ABILITIES.filter((ability) => next.includes(ability)) : undefined,
            )
          }
        />
      </div>
      {primary ? (
        <>
          <div className={PAIRED}>
            <MultiSelect
              inForm
              label="Primary ability"
              noun="abilities"
              options={ABILITY_OPTIONS}
              selected={primary.abilities}
              onChange={(next) =>
                set(
                  "primaryAbility",
                  writePrimaryAbility({
                    abilities: next as typeof primary.abilities,
                    all: primary.all,
                  }),
                )
              }
            />
          </div>
          {primary.abilities.length > 1 && (
            <div className={PAIRED}>
              <FormField label="Primary ability needs">
                {(control) => (
                  <Select
                    {...control}
                    options={NEEDS}
                    value={primary.all ? "all" : "any"}
                    onChange={(next) =>
                      set(
                        "primaryAbility",
                        writePrimaryAbility({ abilities: primary.abilities, all: next === "all" }),
                      )
                    }
                  />
                )}
              </FormField>
            </div>
          )}
        </>
      ) : (
        <p className={`${WHOLE} text-muted text-row`}>
          This class states its primary ability in a shape the form cannot show. Edit it in JSON.
        </p>
      )}
    </div>
  );
}
