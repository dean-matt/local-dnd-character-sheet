import { CompletionContext } from "@codemirror/autocomplete";
import { appliedItemFieldsSchema } from "@dnd/catalog";
import { EditorView } from "codemirror";
import {
  jsonCompletion,
  jsonSchema,
  jsonSchemaHover,
  jsonSchemaLinter,
} from "codemirror-json-schema";
import { afterEach, describe, expect, it } from "vitest";
import { ITEM_JSON_SCHEMA } from "./itemJsonSchema.ts";

let view: EditorView | undefined;

const editorOf = (doc: string) => {
  view = new EditorView({ doc, extensions: jsonSchema(ITEM_JSON_SCHEMA) });
  return view;
};

afterEach(() => view?.destroy());

describe("ITEM_JSON_SCHEMA", () => {
  it("describes every field the sheet applies, the name and the rules text", () => {
    const keys = [...Object.keys(appliedItemFieldsSchema.shape), "name", "entries"];
    const properties = (ITEM_JSON_SCHEMA?.properties ?? {}) as Record<string, object>;
    for (const key of keys) expect(properties[key], key).toHaveProperty("description");
  });

  /** What the editor offers with the cursor at the end of a key typed as `typed`. */
  const suggest = (typed: string) => {
    const doc = `{ "name": "Lantern", "${typed}" }`;
    const at = doc.indexOf('" }');
    const result = jsonCompletion()(new CompletionContext(editorOf(doc).state, at, true));
    return "options" in result ? result.options : [];
  };

  it("suggests every field the sheet applies as a key is typed, each with its description", () => {
    expect(suggest("").map(({ label }) => label)).toEqual(
      expect.arrayContaining(Object.keys(appliedItemFieldsSchema.shape)),
    );
    const [ability] = suggest("abil");
    const info = typeof ability?.info === "function" ? ability.info(ability) : undefined;
    expect(ability?.label).toBe("ability");
    expect(info instanceof Node && info.textContent).toContain(
      'Ability scores: {"wis": 1} adds 1 to Wisdom',
    );
  });

  it("shows a key's description and its value's form on hover", async () => {
    const doc = '{ "name": "Lantern", "ability": { "wis": 1 } }';
    const editor = editorOf(doc);
    const tooltip = await jsonSchemaHover()(editor, doc.indexOf("ability") + 2, 1);
    const text = tooltip?.create(editor).dom.textContent;
    expect(text).toContain('Ability scores: {"wis": 1} adds 1 to Wisdom');
    expect(text).toMatch(/object/);
  });

  it("marks a value of the wrong shape and passes a field it does not model", () => {
    const wrong = '{ "name": "Lantern", "ability": { "wis": "+1" }, "lore": true }';
    const marked = jsonSchemaLinter()(editorOf(wrong));
    expect(marked).toEqual([
      expect.objectContaining({ severity: "error", message: expect.stringMatching(/integer/) }),
    ]);
    expect(marked[0]?.from).toBeGreaterThan(wrong.indexOf('"wis"'));
    expect(marked[0]?.to).toBeLessThanOrEqual(wrong.indexOf('"+1"') + 4);

    expect(jsonSchemaLinter()(editorOf('{ "name": "Lantern", "lore": true }'))).toEqual([]);
  });
});
