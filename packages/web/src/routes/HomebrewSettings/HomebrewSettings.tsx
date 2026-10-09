import { useId } from "react";
import { HomebrewSection } from "./HomebrewSection.tsx";
import { HOMEBREW_KINDS } from "./homebrewKinds.ts";

/** Every homebrew item and spell, outside any character, each written as a 5etools entry. */
export function HomebrewSettings() {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`} className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1
          id={`${id}-title`}
          className="font-semibold text-label text-muted uppercase tracking-label"
        >
          Homebrew
        </h1>
        <p className="mt-1 text-label text-muted">
          Your own items and spells, searched and added to characters beside the catalog's. Rules
          text takes the same <code>{"{@tag}"}</code> markup the catalog's does.
        </p>
      </div>
      {HOMEBREW_KINDS.map((kind) => (
        <HomebrewSection key={kind.collection} kind={kind} />
      ))}
    </section>
  );
}
