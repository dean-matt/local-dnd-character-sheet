import { Navigate } from "react-router";
import { LISTING_KINDS } from "../../lib/homebrewListing.ts";

/** `/homebrew` opens the kind the sidebar lists first. */
export function HomebrewIndex() {
  const [first] = Object.keys(LISTING_KINDS);
  return <Navigate to={`/homebrew/${first}`} replace />;
}
