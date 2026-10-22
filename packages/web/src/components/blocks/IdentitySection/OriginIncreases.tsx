import { ABILITY_LABEL, type CharacterDefinition } from "@dnd/character";
import type { DefinitionEdit } from "../../../hooks/useUpdateCharacterDefinition.ts";
import {
  type IncreaseSource,
  resetIncreases,
  withIncreases,
} from "../../../lib/grantorIncreases.ts";
import { readPicks } from "../../../lib/increasePicks.ts";
import { SourceIncreases } from "../../SourceIncreases.tsx";
import { signed } from "../signed.ts";

type Increase = CharacterDefinition["abilityIncreases"][number];

const listed = (increases: readonly Increase[]) =>
  increases.map((each) => `${signed(each.amount)} ${ABILITY_LABEL[each.ability]}`).join(", ");

export interface OriginIncreasesProps {
  definition: CharacterDefinition;
  source: IncreaseSource;
  write: (key: string, edit: DefinitionEdit) => void;
}

/**
 * The increases a race or background grants, placed as creation places them. A row
 * changed on the sheet leaves its grants for the player to apply, so increases stored
 * under the grantor that do not match the row are named, since they still count, and so is
 * a row's fixed increase not yet stored, each with a way to take the row's own.
 */
export function OriginIncreases({ definition, source, write }: OriginIncreasesProps) {
  const { grantedBy, name, alternatives } = source;
  const mine = definition.abilityIncreases.filter((each) => each.grantedBy === grantedBy);
  const unread = readPicks(alternatives, mine) === undefined;
  const save = (next: Increase[]) =>
    write("abilityIncreases", (latest) => ({
      ...latest,
      abilityIncreases: withIncreases(latest.abilityIncreases, grantedBy, next),
    }));
  const reset = resetIncreases(source);

  return (
    <>
      {unread && (mine.length > 0 || reset.length > 0) && (
        <div role="status" className="mt-2 flex flex-col items-start gap-1 text-row">
          <p className="text-secondary">
            {mine.length > 0
              ? `${listed(mine)} ${mine.length === 1 ? "is" : "are"} kept from before and ${mine.length === 1 ? "does" : "do"} not match ${name}'s increases. Kept increases still count.`
              : `${name}'s increases are not applied.`}
          </p>
          <button type="button" onClick={() => save(reset)} className="text-muted underline">
            {reset.length > 0
              ? `Apply ${name}'s increases`
              : mine.length === 1
                ? "Remove it"
                : "Remove them"}
          </button>
        </div>
      )}
      {alternatives.length > 0 && (
        <div className="mt-2">
          <SourceIncreases source={source} mine={mine} onChange={save} headingHidden />
        </div>
      )}
    </>
  );
}
