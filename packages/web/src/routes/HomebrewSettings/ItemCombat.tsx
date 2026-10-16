import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { MultiSelect } from "../../components/MultiSelect.tsx";
import { Select } from "../../components/Select.tsx";
import { BaseWeaponField } from "./BaseWeaponField.tsx";
import { DiceField } from "./DiceField.tsx";
import {
  type HomebrewFormProps,
  listAt,
  numberAt,
  textAt,
  typedInteger,
  withField,
} from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT } from "./homebrewGrid.ts";
import { NOT_STATED, withCurrent } from "./homebrewOptions.ts";
import {
  DAMAGE_TYPE_CODES,
  isVersatile,
  itemGroup,
  propertyCode,
  WEAPON_CATEGORIES,
  WEAPON_PROPERTIES,
} from "./homebrewVocabulary.ts";
import { useCatalogBlurbs } from "./useCatalogBlurbs.ts";

const PROPERTY_CODES = WEAPON_PROPERTIES.map(({ value }) => value);

/** A weapon's attack or an armor's AC, by the item's type; neither for any other type. */
export function ItemCombat({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const blurbs = useCatalogBlurbs("itemProperty", PROPERTY_CODES, edition);
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const group = itemGroup(entry.type);
  const properties = listAt(entry, "property");
  const dice = (key: string) => ({
    value: textAt(entry, key),
    onChange: (next: string) => set(key, next.trim() === "" ? undefined : next),
  });
  const integer = (
    key: string,
    read = numberAt,
    write = (n: number | undefined): unknown => n,
  ) => ({
    type: "number",
    value: read(entry[key]) ?? "",
    onChange: (event: { target: { value: string } }) =>
      set(key, write(typedInteger(event.target.value))),
  });

  if (group !== "weapon" && group !== "armor") {
    return (
      <p className="text-muted text-row">
        Only a weapon or armor has fields here. Pick one as the type in Basics to set its attack or
        its armor class.
      </p>
    );
  }
  return (
    <div className={FORM_GRID}>
      {group === "weapon" && (
        <>
          <div className={SHORT}>
            <FormField label="Weapon category">
              {(control) => (
                <Select
                  {...control}
                  options={[NOT_STATED, ...WEAPON_CATEGORIES]}
                  value={textAt(entry, "weaponCategory")}
                  onChange={(next) => set("weaponCategory", next || undefined)}
                />
              )}
            </FormField>
          </div>
          <div className={SHORT}>
            <FormField label="Damage type">
              {(control) => (
                <Select
                  {...control}
                  options={withCurrent(
                    [NOT_STATED, ...DAMAGE_TYPE_CODES],
                    textAt(entry, "dmgType"),
                  )}
                  value={textAt(entry, "dmgType")}
                  onChange={(next) => set("dmgType", next || undefined)}
                />
              )}
            </FormField>
          </div>
          <div className={PAIRED}>
            <BaseWeaponField
              current={textAt(entry, "baseItem")}
              edition={edition}
              error={errorFor("baseItem")}
              onChange={(next) => set("baseItem", next)}
            />
          </div>
          <div className={PAIRED}>
            <MultiSelect
              inForm
              label="Properties"
              noun="properties"
              options={WEAPON_PROPERTIES.map((option) => ({
                ...option,
                description: blurbs[option.value],
              }))}
              selected={properties.flatMap((property) => propertyCode(property) ?? [])}
              onChange={(chosen) => {
                const kept = properties.filter((property) => {
                  const code = propertyCode(property);
                  return code === undefined || chosen.includes(code);
                });
                const added = chosen.filter(
                  (code) => !kept.some((property) => propertyCode(property) === code),
                );
                const next = [...kept, ...added];
                const withProperties = withField(
                  entry,
                  "property",
                  next.length > 0 ? next : undefined,
                );
                // A versatile die belongs to the Versatile property, so it leaves with it.
                onChange(
                  chosen.includes("V")
                    ? withProperties
                    : withField(withProperties, "dmg2", undefined),
                );
              }}
            />
          </div>
          <div className={PAIRED}>
            <DiceField
              label="Damage"
              placeholder="1d8"
              error={errorFor("dmg1")}
              {...dice("dmg1")}
            />
          </div>
          {isVersatile(entry) && (
            <div className={PAIRED}>
              <DiceField
                label="Versatile damage"
                placeholder="1d10"
                error={errorFor("dmg2")}
                {...dice("dmg2")}
              />
            </div>
          )}
        </>
      )}
      {group === "armor" && (
        <div className={SHORT}>
          <InputField label="Armor class" min={0} step={1} {...integer("ac")} />
        </div>
      )}
    </div>
  );
}
