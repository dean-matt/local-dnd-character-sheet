import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { MultiSelect } from "../../components/MultiSelect.tsx";
import { Select } from "../../components/Select.tsx";
import { isRecord } from "../../lib/entryGuards.ts";
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
  itemGroup,
  WEAPON_CATEGORIES,
  WEAPON_PROPERTIES,
} from "./homebrewVocabulary.ts";

/** A weapon property's code: `V` for `V|XPHB`, and for Lance's `{uid: "V|XPHB", note}`. */
function propertyCode(property: unknown): string | undefined {
  const named = isRecord(property) ? property.uid : property;
  return typeof named === "string" ? named.split("|")[0] : undefined;
}

/** A weapon's attack or an armor's AC, by the item's type; neither for any other type. */
export function ItemCombat({ entry, onChange }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const group = itemGroup(entry.type);
  const baseItem = textAt(entry, "baseItem").split("|");
  const properties = listAt(entry, "property");
  const text = (key: string) => ({
    value: textAt(entry, key),
    onChange: (event: { target: { value: string } }) =>
      set(key, event.target.value === "" ? undefined : event.target.value),
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
            <InputField
              label="Base weapon"
              placeholder="longsword"
              value={baseItem[0] ?? ""}
              onChange={(event) =>
                set(
                  "baseItem",
                  event.target.value === ""
                    ? undefined
                    : [event.target.value, ...baseItem.slice(1)].join("|"),
                )
              }
            />
          </div>
          <div className={PAIRED}>
            <MultiSelect
              inForm
              label="Properties"
              noun="properties"
              options={WEAPON_PROPERTIES}
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
                set("property", next.length > 0 ? next : undefined);
              }}
            />
          </div>
          <div className={PAIRED}>
            <InputField label="Damage" placeholder="1d8" {...text("dmg1")} />
          </div>
          <div className={PAIRED}>
            <InputField label="Versatile damage" placeholder="1d10" {...text("dmg2")} />
          </div>
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
