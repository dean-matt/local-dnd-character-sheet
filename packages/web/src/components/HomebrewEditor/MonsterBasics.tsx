import { isRecord } from "../../lib/entryGuards.ts";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { MultiSelect } from "../MultiSelect.tsx";
import { Select } from "../Select.tsx";
import { type HomebrewFormProps, listAt, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT, WHOLE } from "./homebrewGrid.ts";
import { MonsterAlignment } from "./MonsterAlignment.tsx";
import { MonsterTypeTags } from "./MonsterTypeTags.tsx";
import { ratingOf, withRating, withTypeField } from "./monsterShapes.ts";
import { RACE_SIZES } from "./raceSizes.ts";

const SIZES = RACE_SIZES.filter(({ value }) => value !== "V");

interface Option {
  value: string;
  label: string;
}

/** `options`, with `value` offered as written where it is stated and none of them. */
const offering = (options: Option[], value: string): Option[] =>
  !value || options.some((option) => option.value === value)
    ? options
    : [...options, { value, label: value }];

const SWARM_SIZES = [{ value: "", label: "None" }, ...SIZES];

const TYPE_KEYS = new Set(["type", "tags", "swarmSize"]);

const CREATURE_TYPES = [
  "aberration",
  "beast",
  "celestial",
  "construct",
  "dragon",
  "elemental",
  "fey",
  "fiend",
  "giant",
  "humanoid",
  "monstrosity",
  "ooze",
  "plant",
  "undead",
].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

const RATINGS = [
  "0",
  "1/8",
  "1/4",
  "1/2",
  ...Array.from({ length: 30 }, (_, at) => `${at + 1}`),
].map((value) => ({ value, label: value }));

/** A homebrew monster's name, size, creature type, swarm size and tags, alignment and challenge rating. */
export function MonsterBasics(props: HomebrewFormProps) {
  const { entry, onChange, errorFor } = props;
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const sizes = listAt(entry, "size").filter((code): code is string => typeof code === "string");
  const { type } = entry;
  const typeText = typeof type === "string" ? type : isRecord(type) ? String(type.type ?? "") : "";
  const swarm = isRecord(type) && typeof type.swarmSize === "string" ? type.swarmSize : "";
  const rating = ratingOf(entry.cr);
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
      <div className={PAIRED}>
        <MultiSelect
          inForm
          label="Size"
          noun="sizes"
          options={SIZES}
          selected={sizes}
          onChange={(next) =>
            set(
              "size",
              SIZES.map(({ value }) => value).filter((code) => next.includes(code)),
            )
          }
        />
        {errorFor("size")}
      </div>
      <div className={SHORT}>
        <FormField label="Type" error={errorFor("type")}>
          {(control) => (
            <Select
              {...control}
              options={offering(CREATURE_TYPES, typeText)}
              value={typeText}
              onChange={(next) => set("type", isRecord(type) ? { ...type, type: next } : next)}
            />
          )}
        </FormField>
      </div>
      <div className={SHORT}>
        <FormField label="Swarm size">
          {(control) => (
            <Select
              {...control}
              options={offering(SWARM_SIZES, swarm)}
              value={swarm}
              onChange={(next) => set("type", withTypeField(type, "swarmSize", next || undefined))}
            />
          )}
        </FormField>
      </div>
      <div className={SHORT}>
        <FormField label="Challenge rating" error={errorFor("cr")}>
          {(control) => (
            <Select
              {...control}
              options={offering(RATINGS, rating)}
              value={rating}
              onChange={(next) => set("cr", withRating(entry.cr, next))}
            />
          )}
        </FormField>
      </div>
      <div className={WHOLE}>
        <MonsterTypeTags type={type} onChange={(next) => set("type", next)} />
      </div>
      <MonsterAlignment {...props} />
      {isRecord(type) &&
        (isRecord(type.type) || Object.keys(type).some((key) => !TYPE_KEYS.has(key))) && (
          <p className={`${WHOLE} text-muted text-row`}>
            The type carries a choice of types or a field the form does not edit. Edit those in
            JSON.
          </p>
        )}
    </div>
  );
}
