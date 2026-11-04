import { InputField } from "../InputField.tsx";
import { HomebrewRulesText } from "./HomebrewRulesText.tsx";
import {
  entriesOf,
  type HomebrewFormProps,
  numberAt,
  paragraphsOf,
  typedInteger,
  withField,
} from "./homebrewEntry.ts";

export interface MonsterGroupLeadProps extends HomebrewFormProps {
  /** The group's name, which labels its introduction: `Reactions`. */
  legend: string;
  /** The key of the paragraphs the stat block prints above the rows: `reactionHeader`. */
  header?: string;
  /**
   * True for the legendary actions, whose uses per round the stat block states unless an
   * introduction replaces that line.
   */
  uses?: boolean;
}

/** The fields above a group's rows: the legendary action uses and the introducing text. */
export function MonsterGroupLead({
  entry,
  onChange,
  errorFor,
  legend,
  header,
  uses,
}: MonsterGroupLeadProps) {
  return (
    <>
      {uses && (
        <div className="w-32">
          <InputField
            label="Legendary action uses"
            type="number"
            min={1}
            step={1}
            placeholder="3"
            value={numberAt(entry.legendaryActions) ?? ""}
            onChange={(event) =>
              onChange(withField(entry, "legendaryActions", typedInteger(event.target.value)))
            }
            error={errorFor("legendaryActions")}
          />
        </div>
      )}
      {header && (
        <HomebrewRulesText
          label={`${legend} introduction`}
          text={paragraphsOf(entry[header])}
          onText={(text) => onChange(withField(entry, header, entriesOf(text)))}
          error={errorFor(header)}
        />
      )}
    </>
  );
}
