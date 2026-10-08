import { ABILITY_LABEL } from "@dnd/character";
import { useClassGrants } from "../../hooks/useClassGrants.ts";
import { grantNames } from "./grants.ts";
import type { ClassEntry } from "./useClassEntries.ts";

/**
 * What one class gives the character at its level: the saving throws and proficiencies it
 * lands, a later class's multiclass gains alone, and the features the sheet lists from it.
 */
export function ClassGrantsSummary({ entry, first }: { entry: ClassEntry; first: boolean }) {
  const { catalogClass, level, grants } = entry;
  const byLevel = useClassGrants(catalogClass, Math.max(level, 1));
  if (catalogClass === undefined || grants === undefined) return null;
  const proficiencies = grantNames(grants);
  const features = [...new Set(byLevel.data?.features.map((feature) => feature.name))];
  return (
    <div className="flex flex-col gap-1 text-muted text-row">
      {grants.savingThrows.length > 0 && (
        <p>
          Saving throws: {grants.savingThrows.map((ability) => ABILITY_LABEL[ability]).join(", ")}
        </p>
      )}
      {proficiencies.length > 0 && (
        <p>
          {first ? "Grants" : "Multiclassing grants"}: {proficiencies.join(", ")}
        </p>
      )}
      {features.length > 0 && (
        <p>
          Features by level {level}: {features.join(", ")}
        </p>
      )}
    </div>
  );
}
