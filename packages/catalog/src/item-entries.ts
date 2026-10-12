import { z } from "zod";
import { type Entries, rowEntries } from "./entry.ts";

/**
 * Upstream's back-references from an item to what an Artificer replicates it with:
 * `classFeatures` holds `name|class|classSource|level|source`, `optionalfeatures`
 * `name|source`. Neither grants the bearer anything. A magic variant states them under
 * `inherits`, which the expanded item and the variant's detail both lift to the top level.
 */
const replicationSchema = z.looseObject({
  classFeatures: z.array(z.string().min(1)).optional().catch(undefined),
  optionalfeatures: z.array(z.string().min(1)).optional().catch(undefined),
});

const titled = (name: string) => name.replace(/(^|\s)\S/g, (start) => start.toUpperCase());

/** `ref`'s first `arity` fields, padded, then a display: upstream writes the name lowercase. */
function tag(name: string, ref: string, arity: number): string {
  const fields = Array.from({ length: arity }, (_, index) => ref.split("|")[index] ?? "");
  return `{@${name} ${fields.join("|")}|${titled(fields[0] ?? "")}}`;
}

/**
 * An item row's rules text, closed by a note naming what an Artificer replicates it with
 * where upstream records one. Every value upstream carries is the Artificer's Replicate
 * Magic Item, as a class feature or an infusion, so the note names the class rather than
 * reading it off the reference. A reference the catalog does not answer renders unlinked.
 */
export function itemEntries(json: Record<string, unknown>): Entries {
  const { classFeatures = [], optionalfeatures = [] } = replicationSchema.parse(json);
  const means = [
    ...classFeatures.map((ref) => tag("classFeature", ref, 5)),
    ...optionalfeatures.map((ref) => `the ${tag("optfeature", ref, 2)} infusion`),
  ];
  const note =
    means.length > 0 ? [`An Artificer can replicate this item with ${means.join(" or ")}.`] : [];
  return [...rowEntries(json), ...note];
}
