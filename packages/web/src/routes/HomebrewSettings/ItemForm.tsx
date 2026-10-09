import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { isRecord } from "../../lib/entryGuards.ts";
import { RARITIES } from "../../lib/rarities.ts";
import { HomebrewCheckbox } from "./HomebrewCheckbox.tsx";
import { HomebrewCheckboxGroup } from "./HomebrewCheckboxGroup.tsx";
import { HomebrewRulesText } from "./HomebrewRulesText.tsx";
import {
  chosenIn,
  entriesOf,
  type HomebrewFormProps,
  listAt,
  numberAt,
  paragraphsOf,
  previewOf,
  signed,
  textAt,
  typedInteger,
  typedNumber,
  unsigned,
  withChosen,
  withField,
} from "./homebrewEntry.ts";
import {
  CONDITIONS,
  DAMAGE_TYPE_CODES,
  DAMAGE_TYPE_NAMES,
  GROUP_FIELDS,
  ITEM_TYPES,
  itemGroup,
  WEAPON_CATEGORIES,
  WEAPON_PROPERTIES,
} from "./homebrewVocabulary.ts";

const NOT_STATED = { value: "", label: "Not stated" };
const GRID = "grid gap-3 sm:grid-cols-2";

/** A weapon property's code: `V` for `V|XPHB`, and for Lance's `{uid: "V|XPHB", note}`. */
function propertyCode(property: unknown): string | undefined {
  const named = isRecord(property) ? property.uid : property;
  return typeof named === "string" ? named.split("|")[0] : undefined;
}

/** A Select's options, with `current` added under its own spelling where none lists it. */
function withCurrent(options: { value: string; label: string }[], current: string) {
  return options.some((option) => option.value === current)
    ? options
    : [...options, { value: current, label: current }];
}

/**
 * A homebrew item's form: the fields every item carries, then a weapon's attack or an
 * armor's AC where its type is one, then what it grants against damage and conditions, then
 * its rules text. Picking a type in another group drops the fields the old group carried.
 */
export function ItemForm({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const type = typeof entry.type === "string" ? (entry.type.split("|")[0] ?? "") : "";
  const group = itemGroup(entry.type);
  const rarity = textAt(entry, "rarity");
  const value = numberAt(entry.value);
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
  const defenses = (key: string, legend: string, options: typeof CONDITIONS) => (
    <HomebrewCheckboxGroup
      legend={legend}
      options={options}
      chosen={chosenIn(listAt(entry, key))}
      onChange={(chosen) => set(key, withChosen(listAt(entry, key), chosen))}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className={GRID}>
        <InputField
          label="Name"
          value={textAt(entry, "name")}
          onChange={(event) => set("name", event.target.value)}
          error={errorFor("name")}
        />
        <FormField label="Type" error={errorFor("type")}>
          {(control) => (
            <Select
              {...control}
              options={withCurrent([NOT_STATED, ...ITEM_TYPES], type)}
              value={type}
              onChange={(next) => {
                const left = itemGroup(next) === group ? [] : GROUP_FIELDS[group];
                const kept = Object.fromEntries(
                  Object.entries(entry).filter(([key]) => !left.includes(key)),
                );
                const suffix = typeof entry.type === "string" ? entry.type.split("|").slice(1) : [];
                onChange(withField(kept, "type", next ? [next, ...suffix].join("|") : undefined));
              }}
            />
          )}
        </FormField>
        <FormField label="Rarity" error={errorFor("rarity")}>
          {(control) => (
            <Select
              {...control}
              options={withCurrent([NOT_STATED, ...RARITIES], rarity)}
              value={rarity}
              onChange={(next) => set("rarity", next || undefined)}
            />
          )}
        </FormField>
        <div className="flex items-end pb-1.5">
          <HomebrewCheckbox
            label="Requires attunement"
            checked={Boolean(entry.reqAttune)}
            onChange={(checked) => set("reqAttune", checked || undefined)}
            error={errorFor("reqAttune")}
          />
        </div>
        <InputField
          label="Weight (lb.)"
          type="number"
          min={0}
          step="any"
          value={numberAt(entry.weight) ?? ""}
          onChange={(event) => set("weight", typedNumber(event.target.value))}
        />
        <InputField
          label="Value (gp)"
          type="number"
          min={0}
          step="any"
          value={value === undefined ? "" : value / 100}
          onChange={(event) => {
            const gp = typedNumber(event.target.value);
            set("value", gp === undefined ? undefined : Math.round(gp * 100));
          }}
        />
      </div>
      {group === "weapon" && (
        <div className={GRID}>
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
          <InputField label="Damage" placeholder="1d8" {...text("dmg1")} />
          <InputField label="Versatile damage" placeholder="1d10" {...text("dmg2")} />
          <FormField label="Damage type">
            {(control) => (
              <Select
                {...control}
                options={withCurrent([NOT_STATED, ...DAMAGE_TYPE_CODES], textAt(entry, "dmgType"))}
                value={textAt(entry, "dmgType")}
                onChange={(next) => set("dmgType", next || undefined)}
              />
            )}
          </FormField>
          <InputField label="Magic bonus" step={1} {...integer("bonusWeapon", unsigned, signed)} />
          <div className="sm:col-span-2">
            <HomebrewCheckboxGroup
              legend="Properties"
              options={WEAPON_PROPERTIES}
              chosen={properties.flatMap((property) => propertyCode(property) ?? [])}
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
        </div>
      )}
      {group === "armor" && (
        <div className={GRID}>
          <InputField label="Armor class" min={0} step={1} {...integer("ac")} />
          <InputField
            label="Magic bonus to AC"
            step={1}
            {...integer("bonusAc", unsigned, signed)}
          />
        </div>
      )}
      {defenses("resist", "Resistances", DAMAGE_TYPE_NAMES)}
      {defenses("immune", "Damage immunities", DAMAGE_TYPE_NAMES)}
      {defenses("conditionImmune", "Condition immunities", CONDITIONS)}
      <HomebrewRulesText
        label="Rules text"
        text={paragraphsOf(entry.entries)}
        onText={(next) => set("entries", entriesOf(next))}
        preview={previewOf(entry.entries)}
        error={errorFor("entries")}
      />
    </div>
  );
}
