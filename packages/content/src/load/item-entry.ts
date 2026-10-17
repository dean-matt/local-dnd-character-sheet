/**
 * Expands an item's `{#itemEntry Name|Source}` entry into the `entriesTemplate` that
 * `items-base.json` carries under that key. The template's `{{item.<field>}}` and
 * `{{getFullImmRes item.<field>}}` placeholders read the item's own fields; a reference
 * that omits the source names the item's own.
 *
 * A reference no template answers reads as the name it carries, and a placeholder no
 * field fills reads as the field's name in words, so unrecognized markup never throws.
 */
import { type Entry, isRecord } from "./json.ts";

export type ItemEntryTemplates = ReadonlyMap<string, unknown[]>;

const REFERENCE = /^\{#itemEntry ([^|}]+)(?:\|([^}]+))?}$/;
const PLACEHOLDER = /\{\{(?:getFullImmRes )?item\.([A-Za-z0-9]+)}}/g;

export function itemEntryTemplates(itemsBase: unknown): ItemEntryTemplates {
  const templates = isRecord(itemsBase) ? itemsBase.itemEntry : undefined;
  return new Map(
    (Array.isArray(templates) ? templates : [])
      .filter(isRecord)
      .filter((template) => Array.isArray(template.entriesTemplate))
      .map((template) => [
        `${String(template.name)}|${String(template.source)}`,
        template.entriesTemplate as unknown[],
      ]),
  );
}

/** `["acid"]` as "acid", `["acid", "cold", "fire"]` as "acid, cold, and fire". */
function valueText(field: string, value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string")) {
    if (value.length <= 2) return value.join(" and ");
    return `${value.slice(0, -1).join(", ")}, and ${value.at(-1)}`;
  }
  return field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function fill(node: unknown, fields: Entry): unknown {
  if (typeof node === "string") {
    return node.replace(PLACEHOLDER, (_all, field: string) => valueText(field, fields[field]));
  }
  if (Array.isArray(node)) return node.map((child) => fill(child, fields));
  if (isRecord(node)) {
    return Object.fromEntries(Object.entries(node).map(([key, v]) => [key, fill(v, fields)]));
  }
  return node;
}

/** `entries` with each whole-string reference replaced by its filled template, recursively. */
export function expandItemEntries(
  entries: unknown,
  fields: Entry,
  templates: ItemEntryTemplates,
): unknown {
  if (Array.isArray(entries)) {
    return entries.flatMap((child) => {
      const reference = typeof child === "string" ? REFERENCE.exec(child) : null;
      if (reference === null) return [expandItemEntries(child, fields, templates)];
      const [, name = "", source = String(fields.source)] = reference;
      const template = templates.get(`${name}|${source}`);
      return template === undefined ? [name] : (fill(template, fields) as unknown[]);
    });
  }
  if (isRecord(entries) && entries.entries !== undefined) {
    return { ...entries, entries: expandItemEntries(entries.entries, fields, templates) };
  }
  return entries;
}
