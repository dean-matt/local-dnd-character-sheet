import type { ComponentProps } from "react";
import { EntryEditor } from "./EntryEditor.tsx";
import { StoredPartsEditor } from "./StoredPartsEditor.tsx";

/** A homebrew entry's editor; a stored class or subclass opens once its features are read. */
export function HomebrewEditor(props: ComponentProps<typeof EntryEditor>) {
  const { collection, record } = props;
  return (collection === "classes" || collection === "subclasses") && record ? (
    <StoredPartsEditor {...props} collection={collection} record={record} />
  ) : (
    <EntryEditor {...props} />
  );
}
