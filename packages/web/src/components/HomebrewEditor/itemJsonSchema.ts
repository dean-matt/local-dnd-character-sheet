import { appliedItemFieldsSchema, entriesSchema, homebrewItemSchema } from "@dnd/catalog";
import { z } from "zod";
import type { JsonEditorProps } from "./JsonEditor.tsx";

export const ENTRIES_TEXT =
  'The rules text. It only displays, {@tags} included: {@ability wis +1} prints, where "ability": {"wis": 1} raises Wisdom.';

/** Backslash-escapes ASCII punctuation, so markdown prints it as written. */
const literal = (text: string) => text.replace(/[!-/:-@[-`{-~]/g, "\\$&");

/**
 * What the item JSON editor suggests and checks: every field the sheet applies, the name and
 * the rules text, each with its description. Any other field passes, as it does on save.
 * The editor renders a description as markdown with smart quotes, which would turn each
 * example's `"` into `“`, so every description is escaped to print as written. It suggests
 * fields in the order `properties` lists them, so they are sorted by name.
 */
export const ITEM_JSON_SCHEMA = JSON.parse(
  JSON.stringify(
    z.toJSONSchema(
      appliedItemFieldsSchema.extend({
        name: homebrewItemSchema.shape.name.describe("The item's name."),
        entries: entriesSchema.optional().describe(ENTRIES_TEXT),
      }),
      // The editor's validator, json-schema-library, reads no draft past 2019-09.
      { io: "input", target: "draft-7" },
    ),
    (key, value) => {
      if (key === "description" && typeof value === "string") return literal(value);
      if (key === "properties" && value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
      }
      return value;
    },
  ),
) as JsonEditorProps["schema"];
