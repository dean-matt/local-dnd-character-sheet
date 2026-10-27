import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useId, useRef } from "react";
import { useLocation } from "react-router";
import { HomebrewSection } from "./HomebrewSection.tsx";
import { HOMEBREW_KINDS } from "./homebrewKinds.ts";

/**
 * Every homebrew row of each kind, outside any character, each written as a 5etools entry. A
 * link's `#homebrew-<kind>` scrolls to that kind once its queries settle, since the rows above
 * it change the page's height as they load and the router's own scroll has already gone to the top.
 */
export function HomebrewSettings() {
  const id = useId();
  const { hash } = useLocation();
  const fetching = useIsFetching();
  const scrolled = useRef(false);

  useEffect(() => {
    if (!hash || fetching > 0 || scrolled.current) return;
    const timer = setTimeout(() => {
      scrolled.current = true;
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
    }, 0);
    return () => clearTimeout(timer);
  }, [hash, fetching]);

  return (
    <section aria-labelledby={`${id}-title`} className="flex max-w-6xl flex-col gap-4">
      <div>
        <h1
          id={`${id}-title`}
          className="font-semibold text-label text-muted uppercase tracking-label"
        >
          Homebrew
        </h1>
        <p className="mt-1 text-label text-muted">
          Your own items, spells, races, classes, backgrounds and feats. Search finds homebrew items
          and spells beside the catalog's. Rules text takes the same <code>{"{@tag}"}</code> markup
          the catalog's does.
        </p>
      </div>
      {HOMEBREW_KINDS.map((kind) => (
        <HomebrewSection key={kind.collection} kind={kind} />
      ))}
    </section>
  );
}
