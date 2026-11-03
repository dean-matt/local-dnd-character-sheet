import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { ErrorState } from "../../ErrorState.tsx";
import {
  homebrewClassFeaturesQuery,
  homebrewClassResourcesQuery,
} from "../../hooks/homebrewClassQuery.ts";
import { LoadingState } from "../../LoadingState.tsx";
import type { HomebrewRow } from "../../lib/homebrewListing.ts";
import { Modal } from "../Modal.tsx";
import { ModalEntry } from "../ModalEntry.tsx";
import { EntryEditor } from "./EntryEditor.tsx";

/** A stored class's editor, opened once its features and resource tables are read, so they edit beside its row. */
export function StoredClassEditor({
  record,
  ...props
}: ComponentProps<typeof EntryEditor> & { record: HomebrewRow }) {
  const features = useQuery(homebrewClassFeaturesQuery(record.id));
  const resources = useQuery(homebrewClassResourcesQuery(record.id));
  if (features.data && resources.data) {
    const json = {
      ...record.json,
      features: features.data,
      resources: resources.data,
    } as HomebrewRow["json"];
    return <EntryEditor {...props} record={{ ...record, json }} />;
  }
  const failed = features.error ?? resources.error;
  return (
    <Modal onClose={props.onClose}>
      <ModalEntry title={`Edit ${record.name}`}>
        {failed ? (
          <ErrorState error={failed} />
        ) : (
          <LoadingState label="Loading the class's features and resources…" />
        )}
      </ModalEntry>
    </Modal>
  );
}
