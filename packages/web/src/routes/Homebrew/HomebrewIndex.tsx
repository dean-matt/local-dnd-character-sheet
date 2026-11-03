import { Navigate } from "react-router";
import { DEFAULT_KIND } from "../../lib/homebrewListing.ts";

/** `/homebrew` opens the default kind. */
export function HomebrewIndex() {
  return <Navigate to={`/homebrew/${DEFAULT_KIND}`} replace />;
}
