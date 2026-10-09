import { characterDefinitionSchema } from "@dnd/character";
import { createForm } from "../../lib/createForm.ts";

/**
 * The creation flow's form: the whole definition, validated by the schema the API takes.
 * Feats start allowed because nearly every 2014 table allows them, though the stored
 * option's absence still means the rule as printed.
 */
export const creationForm = createForm({
  schema: characterDefinitionSchema,
  flow: "creation",
  defaultValues: {
    name: "",
    edition: "one",
    levels: [],
    inventory: [],
    spells: [],
    houseRules: { feats: true },
  },
});
