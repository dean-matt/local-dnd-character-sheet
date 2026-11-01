import { useParams } from "react-router";
import { LISTING_KINDS } from "../../lib/homebrewListing.ts";
import { NotFoundPanel } from "../NotFoundPanel.tsx";
import { HomebrewSection } from "./HomebrewSection.tsx";

/** The list of the kind `/homebrew/:kind` names, or the not-found panel for any other word. */
export function HomebrewKindPage() {
  const { kind } = useParams();
  if (!kind || !Object.hasOwn(LISTING_KINDS, kind)) return <NotFoundPanel />;
  const listing = LISTING_KINDS[kind as keyof typeof LISTING_KINDS];
  return <HomebrewSection key={listing.collection} kind={listing} />;
}
