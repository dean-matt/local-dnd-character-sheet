import { json } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment } from "@codemirror/state";
import { tags } from "@lezer/highlight";
import { basicSetup, EditorView } from "codemirror";
import { jsonSchema } from "codemirror-json-schema";
import { useEffect, useMemo, useRef, useState } from "react";

export interface JsonEditorProps {
  /** `FormField`'s control id; its label carries this id with `-label`. */
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
  value: string;
  onChange: (next: string) => void;
  /** Drives suggestions, hovers and in-place marks; without one the editor only highlights. */
  schema?: Parameters<typeof jsonSchema>[0];
}

const theme = EditorView.theme({
  "&": {
    height: "20lh",
    resize: "vertical",
    overflow: "hidden",
    borderRadius: "var(--radius-control)",
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-ink)",
    fontSize: "var(--text-row)",
  },
  "&:has([aria-invalid='true'])": { borderColor: "var(--color-error)" },
  "&.cm-focused": { outline: "2px solid var(--color-accent)", outlineOffset: "2px" },
  ".cm-gutters": {
    backgroundColor: "var(--color-subtle)",
    color: "var(--color-muted)",
    borderColor: "var(--color-border)",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-ink)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground":
    { backgroundColor: "color-mix(in oklab, var(--color-accent) 30%, var(--color-surface))" },
  // CodeMirror's base styles are light only, so every surface it paints reads a token.
  ".cm-panels": {
    backgroundColor: "var(--color-subtle)",
    color: "var(--color-ink)",
    borderColor: "var(--color-border)",
  },
  ".cm-textfield": {
    backgroundColor: "var(--color-surface)",
    color: "var(--color-ink)",
    borderColor: "var(--color-border)",
  },
  ".cm-button": {
    backgroundImage: "none",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-ink)",
    borderColor: "var(--color-border)",
  },
  ".cm-selectionMatch, .cm-panel.cm-panel-lint ul [aria-selected]": {
    backgroundColor: "var(--color-subtle)",
  },
  ".cm-tooltip": {
    maxWidth: "24rem",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-ink)",
    borderColor: "var(--color-border)",
  },
});

/**
 * Text tokens `contrast.test.ts` holds to AA on the surface in both themes, in place of
 * CodeMirror's light-only defaults.
 */
const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--color-accent-text)" },
  { tag: tags.string, color: "var(--color-positive)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--color-secondary)" },
]);

/**
 * JSON text in CodeMirror, controlled by `value`. The content element takes `FormField`'s
 * control props, and its label by id, since a `<label for>` neither names nor focuses a
 * `contenteditable`. Tab is left to the browser, so a keyboard user leaves the editor as
 * from any field.
 */
export function JsonEditor({ value, onChange, schema, ...control }: JsonEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const [attributes] = useState(() => new Compartment());
  const { id } = control;
  const invalid = String(control["aria-invalid"]);
  const describedBy = control["aria-describedby"];
  const contentAttributes = useMemo(
    () =>
      EditorView.contentAttributes.of({
        "aria-labelledby": `${id}-label`,
        // axe counts no contenteditable as focusable, and would flag the scroller around it.
        tabindex: "0",
        id,
        "aria-invalid": invalid,
        ...(describedBy && { "aria-describedby": describedBy }),
      }),
    [id, invalid, describedBy],
  );
  const latest = useRef({ value, schema, contentAttributes, onChange });
  latest.current = { value, schema, contentAttributes, onChange };

  useEffect(() => {
    const { value, schema, contentAttributes } = latest.current;
    const editor = new EditorView({
      parent: host.current as HTMLDivElement,
      doc: value,
      extensions: [
        basicSetup,
        schema ? jsonSchema(schema) : json(),
        theme,
        syntaxHighlighting(highlight),
        attributes.of(contentAttributes),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) latest.current.onChange(update.state.doc.toString());
        }),
      ],
    });
    view.current = editor;
    return () => editor.destroy();
  }, [attributes]);

  useEffect(() => {
    const label = document.getElementById(`${id}-label`);
    const focus = () => view.current?.focus();
    label?.addEventListener("click", focus);
    return () => label?.removeEventListener("click", focus);
  }, [id]);

  useEffect(() => {
    view.current?.dispatch({ effects: attributes.reconfigure(contentAttributes) });
  }, [attributes, contentAttributes]);

  // A whole entry replaced from outside, such as a starter picked, lands as one change.
  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="min-w-0" />;
}
