import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { ErrorState } from "../../ErrorState.tsx";
import { homebrewClassFeaturesQuery } from "../../hooks/homebrewClassQuery.ts";
import { LoadingState } from "../../LoadingState.tsx";
import type { HomebrewRow } from "../../lib/homebrewListing.ts";
import { Modal } from "../Modal.tsx";
import { ModalEntry } from "../ModalEntry.tsx";
import { EntryEditor } from "./EntryEditor.tsx";

/** A stored class's editor, opened once its features are read, so they edit beside its row. */
export function StoredClassEditor({
  record,
  ...props
}: ComponentProps<typeof EntryEditor> & { record: HomebrewRow }) {
  const features = useQuery(homebrewClassFeaturesQuery(record.id));
  if (features.data) {
    const json = { ...record.json, features: features.data } as HomebrewRow["json"];
    return <EntryEditor {...props} record={{ ...record, json }} />;
  }
  return (
    <Modal onClose={props.onClose}>
      <ModalEntry title={`Edit ${record.name}`}>
        {features.isError ? (
          <ErrorState error={features.error} />
        ) : (
          <LoadingState label="Loading the class's features…" />
        )}
      </ModalEntry>
    </Modal>
  );
}
