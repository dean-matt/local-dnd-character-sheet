import { characterDefinitionSchema } from "@dnd/character";
import { createForm } from "../../../lib/createForm.ts";

/**
 * The level-up's form: the whole definition with the new level last, validated by the
 * schema the API takes. Each instance starts from its character, so the form holds no
 * defaults of its own.
 */
export const levelUpForm = createForm({
  schema: characterDefinitionSchema,
  flow: "level-up",
  defaultValues: {},
});
