import type { FeatRecord } from "@dnd/catalog";
import { type CharacterDefinition, type EntryRef, entryKey } from "@dnd/character";
import { z } from "zod";

type Feats = CharacterDefinition["feats"];
type Row = Pick<FeatRecord, "name" | "source">;

/** The catalog feats a background grants, and whether the character has no say in which. */
export interface BackgroundFeatOffers {
  options: Row[];
  fixed: boolean;
}

const alternativeSchema = z.record(z.string(), z.unknown());
const categorySchema = z.object({ anyFromCategory: z.object({ category: z.array(z.string()) }) });

const lowerKey = (name: string, source: string) => `${name}|${source}`.toLowerCase();

/**
 * The feats a background row's `feats` offers. Each entry of the list is an alternative; a
 * `name|source` key names one feat and `anyFromCategory` every feat of those categories.
 * Upstream writes no entry with two feats at the pinned tag, so each key is its own
 * alternative. A name no catalog feat answers offers nothing.
 */
export function backgroundFeatOffers(
  json: Record<string, unknown>,
  catalog: readonly FeatRecord[],
): BackgroundFeatOffers {
  const alternatives = z.array(alternativeSchema).safeParse(json.feats).data ?? [];
  const options = alternatives.flatMap((alternative) => {
    const category = categorySchema.safeParse(alternative).data?.anyFromCategory.category;
    if (category)
      return catalog.filter(({ json: feat }) => category.includes(String(feat.category)));
    return Object.keys(alternative).flatMap((key) =>
      catalog.filter(({ name, source }) => lowerKey(name, source) === key.toLowerCase()),
    );
  });
  const unique = options.filter(
    (row, i) => options.findIndex((each) => entryKey(each) === entryKey(row)) === i,
  );
  const [only] = alternatives;
  return {
    options: unique,
    fixed:
      alternatives.length === 1 &&
      unique.length === 1 &&
      only !== undefined &&
      !categorySchema.safeParse(only).success,
  };
}

const grantedBy = (entry: Feats[number]) =>
  entry.grantedBy?.kind === "background" ? entry.grantedBy.ref : undefined;

/** The feat entries this background granted, in `feats`. */
export const heldFromBackground = (feats: Feats) =>
  feats.filter((entry) => grantedBy(entry) !== undefined);

/**
 * `feats` with the background's feat in step with what it offers: a feat another
 * background granted, or one this background does not offer, goes; a fixed feat is added;
 * a chosen one stays. Returns `feats` itself where nothing changes.
 */
export function withBackgroundFeat(
  feats: Feats,
  background: EntryRef | undefined,
  offers: BackgroundFeatOffers,
): Feats {
  const offered = new Set(offers.options.map(entryKey));
  const keep = (entry: Feats[number]) => {
    const from = grantedBy(entry);
    if (from === undefined) return true;
    return (
      background !== undefined &&
      entryKey(from) === entryKey(background) &&
      offered.has(entryKey(entry.ref))
    );
  };
  const kept = feats.filter(keep);
  const [fixed] = offers.options;
  const next =
    background &&
    offers.fixed &&
    fixed &&
    !heldFromBackground(kept).length &&
    !kept.some((entry) => entryKey(entry.ref) === entryKey(fixed))
      ? [
          ...kept,
          {
            ref: { name: fixed.name, source: fixed.source },
            grantedBy: { kind: "background" as const, ref: background },
          },
        ]
      : kept;
  return next.length === feats.length && next.every((entry, i) => entry === feats[i])
    ? feats
    : next;
}

/** `feats` with `pick` as the background's feat in place of the one held. */
export function withBackgroundPick(feats: Feats, background: EntryRef, pick: Row): Feats {
  return [
    ...feats.filter((entry) => grantedBy(entry) === undefined),
    {
      ref: { name: pick.name, source: pick.source },
      grantedBy: { kind: "background", ref: background },
    },
  ];
}
