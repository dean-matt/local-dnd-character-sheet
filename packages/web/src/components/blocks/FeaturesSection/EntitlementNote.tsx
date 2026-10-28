import { displayName, type OptionalFeatureTally } from "@dnd/character";
import { useHomebrewNames } from "../../../hooks/useHomebrewNames.ts";

/** What entitles the tally's type, and by how much a count past it runs over. */
export function EntitlementNote({ tally }: { tally: OptionalFeatureTally }) {
  const names = useHomebrewNames();
  const from = tally.entitlements
    .map((each) => `${each.known} from ${displayName(each.grantedBy.ref, names)}`)
    .join(", ");
  const over = tally.picks.length > tally.known;
  if (!over) return <p className="text-muted text-row">Entitled to {from}.</p>;
  return (
    <p className="text-error text-row">
      {tally.picks.length} chosen,{" "}
      {tally.known === 0
        ? "and nothing entitles any now."
        : `${tally.picks.length - tally.known} past the ${tally.known} entitled: ${from}.`}
    </p>
  );
}
