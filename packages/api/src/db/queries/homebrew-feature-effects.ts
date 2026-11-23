import type { HomebrewFeatureEffectInput } from "@dnd/character";
import { and, eq } from "drizzle-orm";
import { homebrewFeatureEffects } from "../homebrew.ts";
import type { HomebrewDb } from "./homebrew.ts";

export function listHomebrewFeatureEffects(db: HomebrewDb) {
  return db.select().from(homebrewFeatureEffects).all();
}

export function getHomebrewFeatureEffect(db: HomebrewDb, id: string) {
  return db.select().from(homebrewFeatureEffects).where(eq(homebrewFeatureEffects.id, id)).get();
}

/** The row for `(name, source)`, read only once a write collides. */
export function findHomebrewFeatureEffect(
  db: HomebrewDb,
  { name, source }: Pick<HomebrewFeatureEffectInput, "name" | "source">,
) {
  return db
    .select()
    .from(homebrewFeatureEffects)
    .where(and(eq(homebrewFeatureEffects.name, name), eq(homebrewFeatureEffects.source, source)))
    .get();
}

export function insertHomebrewFeatureEffect(
  db: HomebrewDb,
  id: string,
  input: HomebrewFeatureEffectInput,
) {
  return db
    .insert(homebrewFeatureEffects)
    .values({ id, ...input })
    .returning()
    .get();
}

/** `undefined` where `id` names no row. */
export function updateHomebrewFeatureEffect(
  db: HomebrewDb,
  id: string,
  input: HomebrewFeatureEffectInput,
) {
  return db
    .update(homebrewFeatureEffects)
    .set(input)
    .where(eq(homebrewFeatureEffects.id, id))
    .returning()
    .get();
}

export function deleteHomebrewFeatureEffect(db: HomebrewDb, id: string): boolean {
  return (
    db.delete(homebrewFeatureEffects).where(eq(homebrewFeatureEffects.id, id)).run().changes > 0
  );
}
