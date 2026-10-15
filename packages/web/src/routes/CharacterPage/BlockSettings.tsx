import {
  LIST_BLOCK_SOURCES,
  LIST_FACET_SOURCE,
  type ListBlockSource,
  type ListFilter,
  type PageBlock,
  SHEET_SECTIONS,
  type SheetSection,
  VALUE_BLOCK_FIELDS,
  type ValueBlockField,
} from "@dnd/character";
import { z } from "zod";
import { Field } from "../../components/Field/Field.tsx";
import { FormField } from "../../components/FormField.tsx";
import { Select } from "../../components/Select.tsx";
import { SECTION_LABELS, SOURCE_LABELS, VALUE_LABELS } from "../../lib/blockLabels.ts";
import { ListFilterSettings } from "./ListFilterSettings.tsx";

const options = <K extends string>(keys: readonly K[], labels: Record<K, string>) =>
  keys.map((key) => ({ value: key, label: labels[key] }));

/** Keeps the facets the new source shares, such as the name search, and drops the rest. */
function filterFor(source: ListBlockSource, filter: ListFilter): ListFilter {
  return Object.fromEntries(
    Object.entries(filter).filter(([facet]) => {
      const only = LIST_FACET_SOURCE[facet as keyof typeof LIST_FACET_SOURCE];
      return only === undefined || only === source;
    }),
  );
}

/**
 * What one block shows, edited in place. Each edit takes the latest block rather than the
 * one rendered, so a save landing after another change builds on it. `onChange` takes a
 * pick; `onSave` takes typed text, which saves as it is typed and reports its own failure.
 */
export function BlockSettings({
  block,
  onChange,
  onSave,
}: {
  block: PageBlock;
  onChange: (edit: (latest: PageBlock) => PageBlock) => void;
  onSave: (edit: (latest: PageBlock) => PageBlock) => Promise<void>;
}) {
  switch (block.kind) {
    case "section":
      return (
        <FormField label="Section">
          {(control) => (
            <Select
              {...control}
              options={options(SHEET_SECTIONS, SECTION_LABELS)}
              value={block.section}
              onChange={(section) =>
                onChange(() => ({ kind: "section", section: section as SheetSection }))
              }
            />
          )}
        </FormField>
      );
    case "value":
      return (
        <FormField label="Value">
          {(control) => (
            <Select
              {...control}
              options={options(VALUE_BLOCK_FIELDS, VALUE_LABELS)}
              value={block.field}
              onChange={(field) =>
                onChange(() => ({ kind: "value", field: field as ValueBlockField }))
              }
            />
          )}
        </FormField>
      );
    case "list": {
      const editFilter = (edit: (filter: ListFilter) => ListFilter) => (latest: PageBlock) =>
        latest.kind === "list" ? { ...latest, filter: edit(latest.filter) } : latest;
      return (
        <div className="flex flex-col gap-2">
          <FormField label="List">
            {(control) => (
              <Select
                {...control}
                options={options(LIST_BLOCK_SOURCES, SOURCE_LABELS)}
                value={block.source}
                onChange={(next) => {
                  const source = next as ListBlockSource;
                  onChange((latest) =>
                    latest.kind === "list"
                      ? { ...latest, source, filter: filterFor(source, latest.filter) }
                      : latest,
                  );
                }}
              />
            )}
          </FormField>
          <ListFilterSettings
            block={block}
            onChange={(edit) => onChange(editFilter(edit))}
            onSave={(edit) => onSave(editFilter(edit))}
          />
        </div>
      );
    }
    case "text":
      return (
        <Field
          mode="edit"
          multiline
          label="Text"
          placeholder="Write a note… {@spell fireball} links a spell."
          current={block.text}
          format={(text) => text}
          parse={(raw) => raw}
          schema={z.string()}
          onSave={(text: string) =>
            onSave((latest) => (latest.kind === "text" ? { ...latest, text } : latest))
          }
        />
      );
    case "unknown":
      return (
        <p className="text-muted text-row italic">
          This build doesn't recognize this block. It is kept as stored.
        </p>
      );
  }
}
