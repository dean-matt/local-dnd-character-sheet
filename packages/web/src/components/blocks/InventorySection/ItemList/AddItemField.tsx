import { armsGroupKinds, itemRecordSchema, type SearchHit } from "@dnd/catalog";
import type { CharacterRecord, ContentRef } from "@dnd/character";
import { useState } from "react";
import { ApiError, apiGet } from "../../../../lib/api.ts";
import { CatalogPicker } from "../../../CatalogPicker/CatalogPicker.tsx";
import type { InventoryEntry } from "./editInventoryEntry.ts";

interface PendingVariant {
  ref: ContentRef;
  kinds: string[];
}

interface Refusal {
  message: string;
  /** Set where the rules refuse a pair a table may still hold, so Add anyway is offered. */
  override?: { base: ContentRef; reason: string };
}

const path = (...parts: string[]) => `/items/${parts.map(encodeURIComponent).join("/")}`;

function baseRefusal(hit: SearchHit): string | undefined {
  if ("id" in hit) return "A magic variant takes a catalog base item";
  return hit.item?.variant ? "Another magic variant, not a base item" : undefined;
}

/** What a failed check tells the user, with Add anyway where a table may hold the pair. */
function refusalOf(
  error: unknown,
  variant: PendingVariant,
  base: ContentRef,
  name: string,
  baseKinds: readonly string[],
  overriding: string | undefined,
): Refusal {
  const detail = error instanceof Error ? error.message : String(error);
  if (!(error instanceof ApiError && error.status === 409)) {
    return { message: `${name} as ${variant.ref.name} could not be checked: ${detail}` };
  }
  const message = `${name} cannot take ${variant.ref.name}. ${detail}.`;
  const group = armsGroupKinds(variant.kinds);
  const offer = !overriding && group && baseKinds.every((kind) => group.includes(kind));
  return offer ? { message, override: { base, reason: message } } : { message };
}

/**
 * Adds any catalog or homebrew item. A magic variant asks for its base item next, offering
 * the kinds the variant reaches, and saves the pair once `/items` expands it. A pair the
 * variant refuses says why and offers to add it anyway where both are weapons or both armor,
 * saving the reason beside the entry; a pair the check cannot reach says why and saves nothing.
 */
export function AddItemField({
  edition,
  onAdd,
}: {
  edition: CharacterRecord["edition"];
  onAdd: (entry: Pick<InventoryEntry, "ref" | "variant" | "variantOverride">) => void;
}) {
  const [variant, setVariant] = useState<PendingVariant>();
  const [refusal, setRefusal] = useState<Refusal>();
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
  async function pickBase(
    base: ContentRef,
    name: string,
    baseKinds: readonly string[],
    reason?: string,
  ) {
    if (!variant || checking) return;
    setRefusal(undefined);
    setChecking(name);
    try {
      await apiGet(
        `${path(base.name, base.source, "variants", variant.ref.name, variant.ref.source)}${reason ? "?override=true" : ""}`,
        itemRecordSchema,
      );
    } catch (error) {
      setRefusal(refusalOf(error, variant, base, name, baseKinds, reason));
      return;
    } finally {
      setChecking(undefined);
    }
    onAdd({ ref: base, variant: variant.ref, ...(reason && { variantOverride: reason }) });
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
            filters={{ kind: (armsGroupKinds(variant.kinds) ?? variant.kinds).join(",") }}
            unavailableReason={baseRefusal}
            onPick={(ref, hit) => "name" in ref && pickBase(ref, hit.name, hit.item?.kinds ?? [])}
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
        <div role="alert" className="flex items-center gap-2 text-error text-row">
          <p>{refusal.message}</p>
          {refusal.override && (
            <button
              type="button"
              onClick={() =>
                refusal.override &&
                pickBase(
                  refusal.override.base,
                  refusal.override.base.name,
                  [],
                  refusal.override.reason,
                )
              }
              className="rounded-control border border-border bg-surface px-2 py-1 text-row"
            >
              Add anyway
            </button>
          )}
        </div>
      )}
    </div>
  );
}
