import { useState } from "react";
import { isRecord } from "../../lib/entryGuards.ts";
import { InputField } from "../InputField.tsx";
import { type HomebrewFormProps, listAt, typedInteger, withField } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, SHORT } from "./homebrewGrid.ts";
import { ROW_BUTTON } from "./homebrewRows.ts";

type Alternative = Record<string, unknown>;

const ALTERNATIVE = "flex min-w-0 flex-col gap-3 rounded-control border border-border p-3";
const SHOWN = ["level", "pact", "spell", "optionalfeature"];

const names = (text: string) => {
  const listed = text
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return listed.length > 0 ? listed : undefined;
};

const stringsAt = (part: Alternative, key: string) =>
  listAt(part, key).filter((each) => typeof each === "string");

/** A level as the form holds it: a number, or upstream's `{level, class}` where a class is named. */
function levelOf(part: Alternative): { level?: number; className: string } {
  const { level } = part;
  if (typeof level === "number") return { level, className: "" };
  if (!isRecord(level)) return { className: "" };
  const named = isRecord(level.class) && typeof level.class.name === "string";
  return {
    level: typeof level.level === "number" ? level.level : undefined,
    className: named ? String((level.class as Alternative).name) : "",
  };
}

/** The level back as written, keeping whatever else its object or its class carries. */
function levelValue(part: Alternative, level: number | undefined, className: string) {
  if (level === undefined) return undefined;
  if (!className) return level;
  const written = isRecord(part.level) ? part.level : {};
  const klass = isRecord(written.class) ? written.class : {};
  return { ...written, level, class: { ...klass, name: className } };
}

/**
 * A homebrew optional feature's prerequisites as alternatives, any one of which qualifies:
 * a level, optionally in a named class, a pact boon, spells known and other options held.
 * A part the form has no control for stays as written and is noted, to edit in JSON.
 */
export function OptionalFeaturePrerequisites({ entry, onChange, errorFor }: HomebrewFormProps) {
  const alternatives = listAt(entry, "prerequisite");
  const [removals, setRemovals] = useState(0);
  const write = (next: unknown[]) =>
    onChange(withField(entry, "prerequisite", next.length > 0 ? next : undefined));
  const error = errorFor("prerequisite");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-row">
        A character meeting any one prerequisite may take the feature. None leaves it open to all.
      </p>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
      {alternatives.map((alternative, at) => {
        const position = at + 1;
        const part: Alternative = isRecord(alternative) ? alternative : {};
        const { level, className } = levelOf(part);
        const set = (key: string, value: unknown) =>
          write(
            alternatives.map((each, index) =>
              index === at && isRecord(each) ? withField(each, key, value) : each,
            ),
          );
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a prerequisite has no id; a removal remounts them so the uncontrolled fields restart from what is stored.
          <fieldset key={`${removals}-${at}`} className={ALTERNATIVE}>
            <legend className="px-1 font-semibold text-row">Prerequisite {position}</legend>
            <div className={FORM_GRID}>
              <div className={SHORT}>
                <InputField
                  label="Level"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={level ?? ""}
                  onChange={(event) =>
                    set("level", levelValue(part, typedInteger(event.target.value), className))
                  }
                />
              </div>
              <div className={SHORT}>
                <InputField
                  label="In class"
                  placeholder="Warlock"
                  disabled={level === undefined}
                  value={className}
                  onChange={(event) =>
                    set("level", levelValue(part, level, event.target.value.trim()))
                  }
                />
              </div>
              <div className={SHORT}>
                <InputField
                  label="Pact boon"
                  placeholder="Blade"
                  value={typeof part.pact === "string" ? part.pact : ""}
                  onChange={(event) => set("pact", event.target.value.trim() || undefined)}
                />
              </div>
              <div className={PAIRED}>
                <InputField
                  label="Spells known"
                  placeholder="eldritch blast#c"
                  defaultValue={stringsAt(part, "spell").join(", ")}
                  onChange={(event) => set("spell", names(event.target.value))}
                />
              </div>
              <div className={PAIRED}>
                <InputField
                  label="Options held"
                  placeholder="agonizing blast|phb"
                  defaultValue={stringsAt(part, "optionalfeature").join(", ")}
                  onChange={(event) => set("optionalfeature", names(event.target.value))}
                />
              </div>
            </div>
            {Object.keys(part).some((key) => !SHOWN.includes(key)) && (
              <p className="text-muted text-row">
                Part of this prerequisite is stated in a way the form cannot show. Edit it in JSON.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setRemovals(removals + 1);
                write(alternatives.filter((_, index) => index !== at));
              }}
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
    </div>
  );
}
