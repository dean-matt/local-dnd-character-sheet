import { itemRecordSchema, type SearchHit } from "@dnd/catalog";
import type { CharacterRecord, ContentRef } from "@dnd/character";
import { useState } from "react";
import { ApiError, apiGet } from "../../../../lib/api.ts";
import { CatalogPicker } from "../../../CatalogPicker/CatalogPicker.tsx";
import type { InventoryEntry } from "./editInventoryEntry.ts";

interface PendingVariant {
  ref: ContentRef;
  kinds: string[];
}

const path = (...parts: string[]) => `/items/${parts.map(encodeURIComponent).join("/")}`;

function baseRefusal(hit: SearchHit): string | undefined {
  if ("id" in hit) return "A magic variant takes a catalog base item";
  return hit.item?.variant ? "Another magic variant, not a base item" : undefined;
}

/**
 * Adds any catalog or homebrew item. A magic variant asks for its base item next, offering
 * the kinds the variant reaches, and saves the pair once `/items` expands it. A pair the
 * variant refuses, or one the check cannot reach, says why and saves nothing.
 */
export function AddItemField({
  edition,
  onAdd,
}: {
  edition: CharacterRecord["edition"];
  onAdd: (entry: Pick<InventoryEntry, "ref" | "variant">) => void;
}) {
  const [variant, setVariant] = useState<PendingVariant>();
  const [refusal, setRefusal] = useState<string>();
  const [checking, setChecking] = useState<string>();

  if (!variant) {
    return (
      <CatalogPicker
        label="Add an item"
        edition={edition}
        type="item"
        onPick={(ref, hit) => {
          if ("name" in ref && hit.item?.variant) setVariant({ ref, kinds: hit.item.kinds });
          else onAdd({ ref });
        }}
      />
    );
  }

  // One check at a time, so a second pick while the first is in flight cannot add twice.
  async function pickBase(base: ContentRef, name: string) {
    if (!variant || checking) return;
    setRefusal(undefined);
    setChecking(name);
    try {
      await apiGet(
        path(base.name, base.source, "variants", variant.ref.name, variant.ref.source),
        itemRecordSchema,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setRefusal(
        error instanceof ApiError && error.status === 409
          ? `${name} cannot take ${variant.ref.name}. ${reason}.`
          : `${name} as ${variant.ref.name} could not be checked: ${reason}`,
      );
      return;
    } finally {
      setChecking(undefined);
    }
    onAdd({ ref: base, variant: variant.ref });
    setVariant(undefined);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <CatalogPicker
            label={`Base item for ${variant.ref.name}`}
            edition={edition}
            type="item"
            filters={{ kind: variant.kinds.join(",") }}
            unavailableReason={baseRefusal}
            onPick={(ref, hit) => "name" in ref && pickBase(ref, hit.name)}
            focusOnMount
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setVariant(undefined);
            setRefusal(undefined);
          }}
          className="rounded-control border border-border bg-surface px-2 py-1 text-row"
        >
          Cancel
        </button>
      </div>
      <p role="status" className="text-muted text-row">
        {checking ? `Checking ${checking} as ${variant.ref.name}…` : ""}
      </p>
      {refusal && (
        <p role="alert" className="text-error text-row">
          {refusal}
        </p>
      )}
    </div>
  );
}
