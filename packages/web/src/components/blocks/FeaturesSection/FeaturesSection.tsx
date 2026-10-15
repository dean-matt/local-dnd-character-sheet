/**
 * The Features page: what the character has gained, in one card each for class, race,
 * background and chosen features. Each feature is a row whose name opens its rules text
 * in a modal, and a search narrows every card by name, so a reader looking for one
 * feature skips the rest.
 */
import type { FeatureOrigin } from "@dnd/catalog";
import { type CharacterRecord, optionalFeatureTallies } from "@dnd/character";
import { useId, useState } from "react";
import { EmptyState } from "../../../EmptyState.tsx";
import { ErrorState } from "../../../ErrorState.tsx";
import { useCharacterFeatures } from "../../../hooks/useCharacterFeatures.ts";
import { useOptionalFeatureEntitlements } from "../../../hooks/useOptionalFeatureEntitlements.ts";
import { LoadingState } from "../../../LoadingState.tsx";
import { Card } from "../../Card.tsx";
import { RulesBlock } from "../../RulesBlock/RulesBlock.tsx";
import { FeatureRow } from "./FeatureRow.tsx";
import { byLevelGained, classFeatureLevel } from "./featureOrder.ts";
import { OptionalFeaturePicks } from "./OptionalFeaturePicks.tsx";

/** `byLevel` widgets list in the order gained; race and background keep their printed order. */
const WIDGETS: readonly {
  title: string;
  noun: string;
  origins: readonly FeatureOrigin[];
  byLevel?: "class" | "taken";
  /** Shown with no features in it, where it holds the picks the character may make. */
  picks?: true;
}[] = [
  {
    title: "Class Features",
    noun: "class features",
    origins: ["class", "subclass"],
    byLevel: "class",
  },
  { title: "Race Features", noun: "race features", origins: ["race"] },
  { title: "Background Features", noun: "background features", origins: ["background"] },
  {
    title: "Chosen Features",
    noun: "chosen features",
    origins: ["feat", "optionalFeature"],
    byLevel: "taken",
    picks: true,
  },
];

export function FeaturesSection({ character }: { character: CharacterRecord | undefined }) {
  const features = useCharacterFeatures(character?.id ?? "");
  const entitlements = useOptionalFeatureEntitlements(character?.id ?? "");
  const [query, setQuery] = useState("");
  const inputId = useId();

  if (!character) return <EmptyState>Features isn't available yet.</EmptyState>;
  if (features.isPending) return <LoadingState label="Loading features…" />;
  if (features.isError) return <ErrorState error={features.error} />;

  if (features.data.groups.length === 0) {
    return <EmptyState>{character.name} has no features yet.</EmptyState>;
  }

  // Built only once the entitlements land: read as none while loading, every pick would
  // report itself past a count of 0.
  const tallies = entitlements.isSuccess
    ? optionalFeatureTallies(character.definition.optionalFeatures, entitlements.data.entitlements)
    : [];
  const picking = tallies.length > 0 || entitlements.isError;
  const needle = query.trim().toLowerCase();
  const widgets = WIDGETS.map((widget) => {
    const listed = features.data.groups
      .filter((group) => widget.origins.includes(group.origin))
      .flatMap((group) => group.features.map((feature) => ({ feature, group })));
    const entries = widget.byLevel
      ? byLevelGained(listed, (entry) =>
          widget.byLevel === "class"
            ? classFeatureLevel(character.definition.levels, entry)
            : entry.feature.level,
        )
      : listed;
    const matches = entries.filter(({ feature }) => feature.name.toLowerCase().includes(needle));
    return { ...widget, entries, matches };
  }).filter((widget) => widget.entries.length > 0 || (widget.picks && picking));
  const noMatches = widgets.every((widget) => widget.matches.length === 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="print:hidden">
        <label htmlFor={inputId} className="sr-only">
          Search features
        </label>
        <input
          id={inputId}
          type="search"
          placeholder="Search features…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-control border border-border bg-surface px-3 py-2 text-body"
        />
      </div>
      {/* Rendered even while empty: a live region added with its text is often not announced. */}
      <p role="status" aria-live="polite" className="sr-only">
        {noMatches ? `No feature matches “${query.trim()}”.` : ""}
      </p>
      {/* One block for every feature, filtered out or not, so the section resolves its
          references in one request and a search keystroke sends none. */}
      <RulesBlock content={features.data.groups}>
        {widgets.map((widget) => (
          <Card key={widget.title} title={widget.title}>
            {widget.entries.length === 0 ? null : widget.matches.length === 0 ? (
              <p className="text-body text-muted italic">
                No {widget.noun} match “{query.trim()}”.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {widget.matches.map((entry, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: one name can recur at several levels, and nothing reorders the list.
                  <FeatureRow key={index} {...entry} character={character} />
                ))}
              </ul>
            )}
            {widget.picks && entitlements.isError && (
              <p className="text-error">
                Couldn't read what entitles {character.name} to optional features.
              </p>
            )}
            {widget.picks && tallies.length > 0 && (
              <OptionalFeaturePicks character={character} tallies={tallies} />
            )}
          </Card>
        ))}
      </RulesBlock>
    </div>
  );
}
