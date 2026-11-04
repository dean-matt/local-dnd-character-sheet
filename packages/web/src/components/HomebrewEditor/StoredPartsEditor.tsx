import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { ErrorState } from "../../ErrorState.tsx";
import {
  homebrewClassResourcesQuery,
  homebrewFeaturesQuery,
} from "../../hooks/homebrewClassQuery.ts";
import { LoadingState } from "../../LoadingState.tsx";
import type { HomebrewRow } from "../../lib/homebrewListing.ts";
import { Modal } from "../Modal.tsx";
import { ModalEntry } from "../ModalEntry.tsx";
import { EntryEditor } from "./EntryEditor.tsx";

/**
 * A stored class's or subclass's editor, opened once the parts saved beside its row are read,
 * so they edit beside it: a class's features and resource tables, a subclass's features.
 */
export function StoredPartsEditor({
  record,
  collection,
  ...props
}: ComponentProps<typeof EntryEditor> & {
  record: HomebrewRow;
  collection: "classes" | "subclasses";
}) {
  const isClass = collection === "classes";
  const features = useQuery(homebrewFeaturesQuery(collection, record.id));
  const resources = useQuery({ ...homebrewClassResourcesQuery(record.id), enabled: isClass });
  if (features.data && (resources.data || !isClass)) {
    const json = {
      ...record.json,
      features: features.data,
      ...(isClass && { resources: resources.data }),
    } as HomebrewRow["json"];
    return <EntryEditor {...props} collection={collection} record={{ ...record, json }} />;
  }
  const failed = features.error ?? resources.error;
  return (
    <Modal onClose={props.onClose}>
      <ModalEntry title={`Edit ${record.name}`}>
        {failed ? (
          <ErrorState error={failed} />
        ) : (
          <LoadingState
            label={
              isClass
                ? "Loading the class's features and resources…"
                : "Loading the subclass's features…"
            }
          />
        )}
      </ModalEntry>
    </Modal>
  );
}
