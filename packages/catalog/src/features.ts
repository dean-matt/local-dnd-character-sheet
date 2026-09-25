/**
 * What a character has gained, grouped by what granted it: each class and subclass, the
 * race, the background, the feats and the optional features. A feature carries its
 * catalog row's own `entries` for the token renderer. A reference that resolves to
 * nothing carries the stored name and source instead, so the sheet can show what went
 * missing rather than drop it.
 *
 * A projection of a character rather than a catalog row, it lives here because it
 * carries `entriesSchema` and `packages/character` depends on `rules` alone.
 */
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

/**
 * `level` is the class level a class or subclass feature arrives at, or the character
 * level a feat was taken at. `featureType` is the code an optional feature was picked
 * under — `FS:F`, `MV:B` — since one option can be offered under several.
 */
const featureFields = {
  name: z.string().min(1),
  source: z
    .string()
    .min(1)
    .optional()
    .describe("Absent only on an unresolved homebrew reference, which stores an id and no source"),
  level: z.int().min(1).max(20).optional(),
  featureType: z.string().min(1).optional(),
};

const sheetFeatureSchema = z.discriminatedUnion("resolved", [
  z.strictObject({ resolved: z.literal(true), ...featureFields, entries: entriesSchema }),
  z.strictObject({ resolved: z.literal(false), ...featureFields }),
]);

const FEATURE_ORIGINS = [
  "class",
  "subclass",
  "race",
  "background",
  "feat",
  "optionalFeature",
] as const;

/**
 * `name` is the class, subclass, race or background the group came from. The feat and
 * optional-feature groups gather several grantors, so they carry none.
 */
const featureGroupSchema = z.strictObject({
  origin: z.enum(FEATURE_ORIGINS),
  name: z.string().min(1).optional(),
  features: z.array(sheetFeatureSchema),
});

export const characterFeaturesSchema = z.strictObject({ groups: z.array(featureGroupSchema) });

export type SheetFeature = z.infer<typeof sheetFeatureSchema>;
export type FeatureGroup = z.infer<typeof featureGroupSchema>;
export type FeatureOrigin = (typeof FEATURE_ORIGINS)[number];
export type CharacterFeatures = z.infer<typeof characterFeaturesSchema>;
