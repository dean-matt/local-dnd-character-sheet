import { proficiencyGrantsSchema } from "@dnd/catalog";
import { grantNames, unlandedLanguages } from "./grants.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

/** What a race row grants, naming each granted language no row lands, since the grant drops it. */
export function RaceGrants({ json }: { json: unknown }) {
  const { edition, names } = useIdentityCatalog();
  const grants = proficiencyGrantsSchema.parse(json);
  const granted = grantNames(grants);
  const unlanded = names.isSuccess ? unlandedLanguages(grants, names.data.items, edition) : [];
  return (
    <>
      {granted.length > 0 && (
        <p className="mt-1.5 text-muted text-row">Grants: {granted.join(", ")}</p>
      )}
      {unlanded.length > 0 && (
        <p className="mt-1 text-row text-secondary">
          No language in this edition answers {unlanded.join(", ")}, so the character does not gain
          it.
        </p>
      )}
    </>
  );
}
