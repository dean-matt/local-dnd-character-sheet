import { isRecord } from "../../lib/entryGuards.ts";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { MultiSelect } from "../MultiSelect.tsx";
import { Select } from "../Select.tsx";
import { type HomebrewFormProps, listAt, textAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT, WHOLE } from "./homebrewGrid.ts";
import { MonsterAlignment } from "./MonsterAlignment.tsx";
import { MonsterTextRows } from "./MonsterTextRows.tsx";
import { ratingOf, typeTags, withRating, withTypeTags } from "./monsterShapes.ts";
import { RACE_SIZES } from "./raceSizes.ts";

const SIZES = RACE_SIZES.filter(({ value }) => value !== "V");

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

/** A homebrew monster's name, size, creature type and tags, alignment and challenge rating. */
export function MonsterBasics(props: HomebrewFormProps) {
  const { entry, onChange, errorFor } = props;
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const sizes = listAt(entry, "size").filter((code): code is string => typeof code === "string");
  const { type } = entry;
  const typeText = typeof type === "string" ? type : isRecord(type) ? String(type.type ?? "") : "";
  const typeOptions = CREATURE_TYPES.some(({ value }) => value === typeText)
    ? CREATURE_TYPES
    : [...CREATURE_TYPES, ...(typeText ? [{ value: typeText, label: typeText }] : [])];
  const rating = ratingOf(entry.cr);
  const ratingOptions = RATINGS.some(({ value }) => value === rating)
    ? RATINGS
    : [...RATINGS, ...(rating ? [{ value: rating, label: rating }] : [])];
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
              options={typeOptions}
              value={typeText}
              onChange={(next) => set("type", isRecord(type) ? { ...type, type: next } : next)}
            />
          )}
        </FormField>
      </div>
      <div className={SHORT}>
        <FormField label="Challenge rating" error={errorFor("cr")}>
          {(control) => (
            <Select
              {...control}
              options={ratingOptions}
              value={rating}
              onChange={(next) => set("cr", withRating(entry.cr, next))}
            />
          )}
        </FormField>
      </div>
      <div className={WHOLE}>
        <MonsterTextRows
          noun="type tag"
          legend="Type tags"
          initial={typeTags(type)}
          onChange={(next) => set("type", withTypeTags(type, next))}
        />
      </div>
      <MonsterAlignment {...props} />
      {isRecord(type) && Object.keys(type).some((key) => key !== "type" && key !== "tags") && (
        <p className={`${WHOLE} text-muted text-row`}>
          The type carries a swarm size or a choice of types. Edit those in JSON.
        </p>
      )}
    </div>
  );
}
