import { DAMAGE_TYPES } from "@dnd/catalog";
import { capitalize } from "./capitalize.ts";

/** The damage types a resistance or a spell names, as upstream writes them: lowercase words. */
export const DAMAGE_TYPE_NAMES = Object.values(DAMAGE_TYPES)
  .sort()
  .map((value) => ({ value, label: capitalize(value) }));

/** The conditions an immunity names, lowercase as upstream writes them. */
export const CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
].map((value) => ({ value, label: capitalize(value) }));
