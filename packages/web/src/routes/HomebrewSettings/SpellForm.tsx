import { FormField } from "../../components/FormField.tsx";
import { InputField } from "../../components/InputField.tsx";
import { Select } from "../../components/Select.tsx";
import { isRecord } from "../../lib/entryGuards.ts";
import { SCHOOLS } from "../../lib/spellSchool.ts";
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
  recordAt,
  textAt,
  typedNumber,
  withChosen,
  withField,
} from "./homebrewEntry.ts";
import {
  CASTING_UNITS,
  DAMAGE_TYPE_NAMES,
  DURATION_TYPES,
  DURATION_UNITS,
  RANGE_KINDS,
  RANGE_SHAPES,
  SPELL_LEVELS,
} from "./homebrewVocabulary.ts";
import { upcastSection, upcastText } from "./spellUpcast.ts";

const GRID = "grid gap-3 sm:grid-cols-2";
const SCHOOL_OPTIONS = Object.entries(SCHOOLS).map(([value, label]) => ({ value, label }));
const DISTANCES = new Set(["feet", "miles"]);

/** `record` with `key` set, or removed where `value` is `undefined`; `undefined` once it is empty. */
function withKey(record: Record<string, unknown>, key: string, value: unknown) {
  const next = withField(record, key, value);
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * A homebrew spell's form: level and school, the four casting facts, the damage it deals,
 * its rules text, and the text for casting it with a higher-level slot. Each casting fact
 * edits the first span upstream's list holds; a second span, rare upstream, is kept.
 */
export function SpellForm({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const [time = {}, ...moreTimes] = listAt(entry, "time").map((span) =>
    isRecord(span) ? span : {},
  );
  const [span = {}, ...moreSpans] = listAt(entry, "duration").map((each) =>
    isRecord(each) ? each : {},
  );
  const length = isRecord(span.duration) ? span.duration : {};
  const range = recordAt(entry, "range");
  const distance = isRecord(range.distance) ? range.distance : {};
  const rangeKind = range.type === "special" ? "special" : textAt(distance, "type");
  const components = recordAt(entry, "components");
  const material = components.m;
  const meta = recordAt(entry, "meta");
  const higher = listAt(entry, "entriesHigherLevel")[0];

  const setTime = (next: Record<string, unknown>) => set("time", [next, ...moreTimes]);
  const setSpan = (next: Record<string, unknown> | undefined) =>
    set("duration", next === undefined ? undefined : [next, ...moreSpans]);
  const setRange = (kind: string, amount: unknown, shape: string) => {
    if (kind === "") return set("range", undefined);
    if (kind === "special") return set("range", { type: "special" });
    const far = DISTANCES.has(kind);
    set("range", {
      ...range,
      type: far ? shape : "point",
      distance: { type: kind, ...(far && amount !== undefined && { amount }) },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={GRID}>
        <InputField
          label="Name"
          value={textAt(entry, "name")}
          onChange={(event) => set("name", event.target.value)}
          error={errorFor("name")}
        />
        <FormField label="Level" error={errorFor("level")}>
          {(control) => (
            <Select
              {...control}
              options={SPELL_LEVELS}
              value={String(entry.level ?? "")}
              onChange={(next) => set("level", Number(next))}
            />
          )}
        </FormField>
        <FormField label="School" error={errorFor("school")}>
          {(control) => (
            <Select
              {...control}
              options={SCHOOL_OPTIONS}
              value={textAt(entry, "school")}
              onChange={(next) => set("school", next)}
            />
          )}
        </FormField>
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <InputField
            label="Casting time"
            type="number"
            min={1}
            value={numberAt(time.number) ?? ""}
            onChange={(event) =>
              setTime(
                withField({ unit: "action", ...time }, "number", typedNumber(event.target.value)),
              )
            }
          />
          <FormField label="Unit">
            {(control) => (
              <Select
                {...control}
                options={CASTING_UNITS}
                value={textAt(time, "unit") || "action"}
                onChange={(next) => setTime({ number: 1, ...time, unit: next })}
              />
            )}
          </FormField>
        </div>
        <FormField label="Range">
          {(control) => (
            <Select
              {...control}
              options={RANGE_KINDS}
              value={rangeKind}
              onChange={(next) =>
                setRange(
                  next,
                  distance.amount,
                  range.type === "special" ? "point" : textAt(range, "type") || "point",
                )
              }
            />
          )}
        </FormField>
        {DISTANCES.has(rangeKind) && (
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <InputField
              label="Distance"
              type="number"
              min={0}
              value={numberAt(distance.amount) ?? ""}
              onChange={(event) =>
                setRange(rangeKind, typedNumber(event.target.value), textAt(range, "type"))
              }
            />
            <FormField label="Area">
              {(control) => (
                <Select
                  {...control}
                  options={RANGE_SHAPES}
                  value={textAt(range, "type")}
                  onChange={(next) => setRange(rangeKind, distance.amount, next)}
                />
              )}
            </FormField>
          </div>
        )}
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-muted text-row">Components</legend>
        <div className="flex flex-wrap items-end gap-4">
          {(["v", "s"] as const).map((key) => (
            <HomebrewCheckbox
              key={key}
              label={key === "v" ? "Verbal" : "Somatic"}
              checked={components[key] === true}
              onChange={(checked) =>
                set("components", withKey(components, key, checked || undefined))
              }
            />
          ))}
          <div className="min-w-48 flex-1">
            <InputField
              label="Material"
              placeholder="a pinch of salt"
              value={
                typeof material === "string"
                  ? material
                  : isRecord(material)
                    ? textAt(material, "text")
                    : ""
              }
              onChange={(event) => {
                const said = event.target.value;
                const next = isRecord(material) ? { ...material, text: said } : said;
                set("components", withKey(components, "m", said === "" ? undefined : next));
              }}
            />
          </div>
        </div>
      </fieldset>
      <div className={GRID}>
        <FormField label="Duration" error={errorFor("duration")}>
          {(control) => (
            <Select
              {...control}
              options={DURATION_TYPES}
              value={textAt(span, "type")}
              onChange={(next) => {
                if (next === "") return setSpan(undefined);
                const { duration: _length, concentration: _held, ...rest } = span;
                setSpan(
                  next === "timed"
                    ? { ...rest, type: next, duration: { type: "minute", amount: 1 } }
                    : { ...rest, type: next },
                );
              }}
            />
          )}
        </FormField>
        {span.type === "timed" && (
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <InputField
              label="Lasts"
              type="number"
              min={1}
              value={numberAt(length.amount) ?? ""}
              onChange={(event) =>
                setSpan({
                  ...span,
                  duration: withField(length, "amount", typedNumber(event.target.value)),
                })
              }
            />
            <FormField label="Unit">
              {(control) => (
                <Select
                  {...control}
                  options={DURATION_UNITS}
                  value={textAt(length, "type")}
                  onChange={(next) => setSpan({ ...span, duration: { ...length, type: next } })}
                />
              )}
            </FormField>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        {span.type === "timed" && (
          <HomebrewCheckbox
            label="Concentration"
            checked={span.concentration === true}
            onChange={(checked) => setSpan(withField(span, "concentration", checked || undefined))}
          />
        )}
        <HomebrewCheckbox
          label="Ritual"
          checked={meta.ritual === true}
          onChange={(checked) => set("meta", withKey(meta, "ritual", checked || undefined))}
          error={errorFor("meta")}
        />
      </div>
      <HomebrewCheckboxGroup
        legend="Damage types"
        options={DAMAGE_TYPE_NAMES}
        chosen={chosenIn(listAt(entry, "damageInflict"))}
        onChange={(chosen) =>
          set("damageInflict", withChosen(listAt(entry, "damageInflict"), chosen))
        }
      />
      <HomebrewRulesText
        label="Rules text"
        text={paragraphsOf(entry.entries)}
        onText={(next) => set("entries", entriesOf(next))}
        preview={previewOf(entry.entries)}
        error={errorFor("entries")}
      />
      <HomebrewRulesText
        label="At higher levels"
        text={upcastText(entry.entriesHigherLevel)}
        onText={(next) => {
          const paragraphs = entriesOf(next);
          set("entriesHigherLevel", paragraphs && [upcastSection(higher, paragraphs, edition)]);
        }}
        preview={previewOf(entry.entriesHigherLevel)}
      />
    </div>
  );
}
