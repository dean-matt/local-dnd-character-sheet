/**
 * A deity's and a language's fields, as a bold-labelled line each ahead of the row's own
 * prose, for a catalog detail to render: most of these rows carry no prose at all. A field
 * the row lacks leaves its line out.
 */
import { type Entries, rowEntries } from "./entry.ts";
import { alignmentWords, line } from "./monster.ts";

type Json = Record<string, unknown>;

const string = (value: unknown) => (typeof value === "string" ? value : undefined);

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((one) => typeof one === "string") : [];

const joined = (value: unknown) => strings(value).join(", ") || undefined;

const capitalized = (value: string | undefined) =>
  value && value.charAt(0).toUpperCase() + value.slice(1);

export function deityEntries(json: Json): Entries {
  const alignment = strings(json.alignment);
  return [
    ...line("Pantheon", string(json.pantheon)),
    ...line("Alignment", capitalized(alignment.length > 0 ? alignmentWords(alignment) : undefined)),
    ...line("Domains", joined(json.domains)),
    ...line("Province", string(json.province)),
    ...line("Symbol", string(json.symbol)),
    ...rowEntries(json),
  ];
}

/** A 2024 language names where it comes from as its `origin`, in place of typical speakers. */
export function languageEntries(json: Json): Entries {
  return [
    ...line("Type", capitalized(string(json.type))),
    ...line("Script", string(json.script)),
    ...line("Typical Speakers", joined(json.typicalSpeakers)),
    ...line("Origin", string(json.origin)),
    ...rowEntries(json),
  ];
}
