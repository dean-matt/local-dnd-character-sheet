import { defenseTraitSchema, raceTraitsSchema } from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";

type Size = NonNullable<CharacterDefinition["size"]>;

/**
 * What a race or merged subrace row leaves the player to pick: a size where it offers more
 * than one, and a damage type where it offers a choice of resistance. Each list is empty
 * where the row decides for itself.
 */
export function raceChoices(json: object | undefined): {
  sizes: readonly Size[];
  resistances: readonly string[];
} {
  const sizes = raceTraitsSchema.safeParse(json).data?.sizes ?? [];
  return {
    sizes: sizes.length > 1 ? sizes : [],
    resistances: defenseTraitSchema.safeParse(json ?? {}).data?.resistChoice ?? [],
  };
}
