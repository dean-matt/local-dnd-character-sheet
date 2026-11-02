import type { ComponentProps } from "react";
import { EntryEditor } from "./EntryEditor.tsx";
import { StoredClassEditor } from "./StoredClassEditor.tsx";

/** A homebrew entry's editor; a stored class's opens once its features are read. */
export function HomebrewEditor(props: ComponentProps<typeof EntryEditor>) {
  const { collection, record } = props;
  return collection === "classes" && record ? (
    <StoredClassEditor {...props} record={record} />
  ) : (
    <EntryEditor {...props} />
  );
}
