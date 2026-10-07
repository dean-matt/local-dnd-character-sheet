import { SkillChoicesField } from "./SkillChoicesField.tsx";
import {
  StartingEquipmentField,
  type StartingEquipmentFieldProps,
} from "./StartingEquipmentField.tsx";

/** What the character is trained in on the left, and what they carry on the right. */
export function ProficienciesStep(equipment: StartingEquipmentFieldProps) {
  return (
    <div className="grid gap-7 sm:grid-cols-2">
      <SkillChoicesField />
      <StartingEquipmentField {...equipment} />
    </div>
  );
}
