import { characterDefinitionSchema } from "@dnd/character";
import { Field } from "../../../Field/Field.tsx";

const quantitySchema = characterDefinitionSchema.shape.inventory.element.shape.quantity.unwrap();

/** How many of the item the entry holds; a count under one is refused rather than removing it. */
export function QuantityField({
  name,
  quantity,
  onSave,
}: {
  name: string;
  quantity: number;
  onSave: (quantity: number) => Promise<void>;
}) {
  return (
    <Field
      mode="edit"
      label={`${name} quantity`}
      labelHidden
      inputMode="numeric"
      inputClassName="w-12 py-0.5 text-right"
      current={quantity}
      format={String}
      parse={(raw) => Number(raw.trim())}
      schema={quantitySchema}
      onSave={onSave}
    />
  );
}
