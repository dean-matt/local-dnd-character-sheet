/**
 * `data/spells/spells-*.json` into the Tier A `spells` table.
 *
 * Spells are the clean case: no `_copy` to resolve and no `edition` field to
 * read, so a row is four columns lifted off the entry plus an edition derived
 * from its source. Everything else stays in `json`, `{@tag}` markup included —
 * that is rendered at read time, not here.
 */
import { editionOf } from "./edition.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, isRecord } from "./json.ts";

function text(entry: Entry, key: string, context: string): string {
  const value = entry[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`${context}: ${key} is missing or not a string`);
  }
  return value;
}

function toRow(entry: unknown, context: string): Row {
  if (!isRecord(entry)) throw new Error(`${context} is not an object`);
  const source = text(entry, "source", context);
  const level = entry.level;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > 9) {
    throw new Error(`${context}: level ${String(level)} is not a whole number from 0 to 9`);
  }
  const duration = Array.isArray(entry.duration) ? entry.duration : [];
  const meta = entry.meta;
  return {
    name: text(entry, "name", context),
    source,
    edition: editionOf(source),
    level,
    school: text(entry, "school", context),
    concentration: duration.some((span) => isRecord(span) && span.concentration === true) ? 1 : 0,
    ritual: isRecord(meta) && meta.ritual === true ? 1 : 0,
    json: JSON.stringify(entry),
  };
}

export const spells: Loader = {
  name: "spells",
  files: ["data/spells/spells-*.json"],
  rows: (sources) => ({
    spells: [...sources].flatMap(([path, source]) => {
      if (!isRecord(source) || !Array.isArray(source.spell)) {
        throw new Error(`${path} carries no spell array`);
      }
      return source.spell.map((entry, index) => toRow(entry, `${path}[${index}]`));
    }),
  }),
};
