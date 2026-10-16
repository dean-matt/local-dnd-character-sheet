import { appliedItemFieldsSchema, entriesSchema, homebrewItemSchema } from "@dnd/catalog";
import { z } from "zod";
import type { JsonEditorProps } from "./JsonEditor.tsx";

export const ENTRIES_TEXT =
  'The rules text. It only displays, {@tags} included: {@ability wis +1} prints, where "ability": {"wis": 1} raises Wisdom.';

/**
 * What the item JSON editor suggests and checks: every field the sheet applies, the name and
 * the rules text, each with its description. Any other field passes, as it does on save.
 */
export const ITEM_JSON_SCHEMA = z.toJSONSchema(
  appliedItemFieldsSchema.extend({
    name: homebrewItemSchema.shape.name.describe("The item's name."),
    entries: entriesSchema.optional().describe(ENTRIES_TEXT),
  }),
  // The editor's validator, json-schema-library, reads no draft past 2019-09.
  { io: "input", target: "draft-7" },
) as JsonEditorProps["schema"];
