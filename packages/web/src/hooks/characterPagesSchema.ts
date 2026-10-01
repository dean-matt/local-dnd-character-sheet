import { characterPageRecordSchema } from "@dnd/character";
import { z } from "zod";

/** A character's whole page list, the shape every page hook reads and writes. */
export const characterPagesSchema = z.array(characterPageRecordSchema);
