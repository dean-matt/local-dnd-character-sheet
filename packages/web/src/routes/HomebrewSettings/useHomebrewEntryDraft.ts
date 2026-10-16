import type { CharacterRecord } from "@dnd/character";
import { useMemo, useState } from "react";
import { checkHomebrewEntry, type HomebrewEntry, parseHomebrewEntry } from "./homebrewDraft.ts";
import type { HomebrewKind, HomebrewRow } from "./homebrewKinds.ts";
import type { HomebrewStarters } from "./homebrewStarters.ts";

type Edition = CharacterRecord["edition"];

/** The entry as a user edits it, without the `source` the server stamps. */
function editable(entry: Record<string, unknown>): HomebrewEntry {
  const { source: _source, ...rest } = entry;
  return rest;
}

/** `value` with every object's keys sorted by name, at any depth; arrays keep their order. */
function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, field]) => [key, sortedKeys(field)]),
  );
}

/** The entry as the JSON mode opens it, its fields in alphabetical order to find them by. */
const asText = (entry: HomebrewEntry) => JSON.stringify(sortedKeys(entry), null, 2);

/**
 * The entry being edited and its edition, read against the kind's schema. `text` is set
 * while the JSON mode is open: the text as typed, which may not parse yet. `revision` counts
 * each time the entry is replaced whole, so the form's own text areas reread it. `changed`
 * turns true on the first edit.
 */
export function useHomebrewEntryDraft(kind: HomebrewKind, record: HomebrewRow | undefined) {
  const [starter, setStarter] = useState(kind.starters[0]);
  const [entry, setEntry] = useState(() => editable(record ? record.json : starter.entry));
  const [text, setText] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [edition, setEdition] = useState<Edition>(record?.edition ?? "one");
  const [changed, setChanged] = useState(false);
  const parsed = useMemo(
    () => (text === undefined ? { entry } : parseHomebrewEntry(text)),
    [text, entry],
  );
  const checked = useMemo(
    () =>
      "entry" in parsed ? checkHomebrewEntry(parsed.entry, edition, kind.inputSchema) : parsed,
    [parsed, edition, kind],
  );
  const shown = useMemo(
    () =>
      "input" in checked
        ? {
            input: checked.input,
            facts: kind.facts(checked.input),
            entries: kind.entries(checked.input),
          }
        : undefined,
    [checked, kind],
  );

  const edit = (next: HomebrewEntry) => {
    setEntry(next);
    setChanged(true);
  };
  const replace = (next: HomebrewEntry) => {
    edit(next);
    setRevision((count) => count + 1);
    if (text !== undefined) setText(asText(next));
  };
  return {
    entry,
    text,
    revision,
    edition,
    starter,
    changed,
    checked,
    shown,
    edit,
    openJson: () => setText(asText(entry)),
    /** Back to the form, once the text parses; `false` where it does not. */
    leaveJson: () => {
      if (!("entry" in parsed)) return false;
      // Typing already marked the draft changed; leaving JSON edits nothing.
      setEntry(parsed.entry);
      setRevision((count) => count + 1);
      setText(undefined);
      return true;
    },
    typeJson: (next: string) => {
      setText(next);
      setChanged(true);
      const read = parseHomebrewEntry(next);
      if ("entry" in read) setEntry(read.entry);
    },
    pickEdition: (next: Edition) => {
      setEdition(next);
      setChanged(true);
      const renamed = "entry" in parsed && kind.forEdition?.(parsed.entry, next);
      if (renamed && renamed !== parsed.entry) replace(renamed);
    },
    pickStarter: (picked: HomebrewStarters[number]) => {
      setStarter(picked);
      replace(editable(picked.entry));
    },
  };
}
