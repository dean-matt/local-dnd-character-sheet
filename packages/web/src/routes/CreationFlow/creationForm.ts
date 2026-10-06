import { characterDefinitionSchema } from "@dnd/character";
import { createForm } from "../../lib/createForm.ts";

/** The creation flow's form: the whole definition, validated by the schema the API takes. */
export const creationForm = createForm({
  schema: characterDefinitionSchema,
  flow: "creation",
  defaultValues: { name: "", edition: "one", levels: [], inventory: [], spells: [] },
});
