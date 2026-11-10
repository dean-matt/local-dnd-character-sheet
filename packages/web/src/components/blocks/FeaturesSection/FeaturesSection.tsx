/**
 * The Features page: the class resource pools a player spends, then what the character has
 * gained, in one card each for class, race, background and chosen features. Each feature
 * is a row whose name opens its rules text in a modal, and a search narrows every feature
 * card by name, so a reader looking for one feature skips the rest.
 */
import type { FeatureOrigin } from "@dnd/catalog";
import {
  type CharacterDerived,
  type CharacterRecord,
  optionalFeatureTallies,
} from "@dnd/character";
import { useId, useState } from "react";
import { EmptyState } from "../../../EmptyState.tsx";
import { ErrorState } from "../../../ErrorState.tsx";
import { useCharacterFeatures } from "../../../hooks/useCharacterFeatures.ts";
import { useOptionalFeatureEntitlements } from "../../../hooks/useOptionalFeatureEntitlements.ts";
import { LoadingState } from "../../../LoadingState.tsx";
import { Card } from "../../Card.tsx";
import { CheckFacet } from "../../Filter/CheckFacet.tsx";
import { FilterButton } from "../../Filter/FilterButton.tsx";
import { inRange, NO_RANGE, type Range } from "../../Filter/facets.ts";
import { RangeFacet } from "../../Filter/RangeFacet.tsx";
import { RulesBlock } from "../../RulesBlock/RulesBlock.tsx";
import { ClassResources } from "./ClassResources/ClassResources.tsx";
import { FeatureRow } from "./FeatureRow.tsx";
import { byLevelGained, classFeatureLevel } from "./featureOrder.ts";
import { OptionalFeaturePicks } from "./OptionalFeaturePicks.tsx";

/** `byLevel` widgets list in the order gained; race and background keep their printed order. */
const WIDGETS: readonly {
  title: string;
  noun: string;
  origins: readonly FeatureOrigin[];
  byLevel?: "class" | "taken";
  /** Carries a Filter button narrowing it by limited uses and, where `byLevel`, the level gained. */
  filterable?: true;
  /** Shown with no features in it, where it holds the picks the character may make. */
  picks?: true;
}[] = [
  {
    title: "Class Features",
    noun: "class features",
    origins: ["class", "subclass"],
    byLevel: "class",
    filterable: true,
  },
  { title: "Race Features", noun: "race features", origins: ["race"], filterable: true },
  { title: "Background Features", noun: "background features", origins: ["background"] },
  {
    title: "Chosen Features",
    noun: "chosen features",
    origins: ["feat", "optionalFeature"],
    byLevel: "taken",
    filterable: true,
    picks: true,
  },
];

const HAS_USES = "has";

const USES_OPTIONS = [
  { value: HAS_USES, label: "Has limited uses" },
  { value: "none", label: "No limited uses" },
];

export function FeaturesSection({
  character,
  derived,
}: {
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  const features = useCharacterFeatures(character?.id ?? "");
  const entitlements = useOptionalFeatureEntitlements(character?.id ?? "");
  const [query, setQuery] = useState("");
  const [ranges, setRanges] = useState<Record<string, Range>>({});
  const [usesPicks, setUsesPicks] = useState<Record<string, string[]>>({});
  const inputId = useId();

  if (!character) return <EmptyState>Features isn't available yet.</EmptyState>;
  // The card needs only the derived block and state, so no features fetch holds it back.
  const resources = derived && <ClassResources character={character} derived={derived} />;
  if (features.isPending || features.isError || features.data.groups.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {resources}
        {features.isPending ? (
          <LoadingState label="Loading features…" />
        ) : features.isError ? (
          <ErrorState error={features.error} />
        ) : (
          <EmptyState>{character.name} has no features yet.</EmptyState>
        )}
      </div>
    );
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
    const levelOf = (entry: (typeof listed)[number]) =>
      widget.byLevel === "class"
        ? classFeatureLevel(character.definition.levels, entry)
        : entry.feature.level;
    const entries = widget.byLevel ? byLevelGained(listed, levelOf) : listed;
    const named = entries.filter(({ feature }) => feature.name.toLowerCase().includes(needle));
    const range = ranges[widget.title] ?? NO_RANGE;
    const uses = usesPicks[widget.title] ?? [];
    const matches = named.filter(
      (entry) =>
        inRange(levelOf(entry), range) &&
        (uses.length === 0 ||
          uses.includes(entry.feature.resolved && entry.feature.uses ? HAS_USES : "none")),
    );
    const active = (range.min !== "" || range.max !== "" ? 1 : 0) + (uses.length > 0 ? 1 : 0);
    return { ...widget, entries, named, matches, range, uses, active };
  }).filter((widget) => widget.entries.length > 0 || (widget.picks && picking));
  const noMatches = widgets.every((widget) => widget.named.length === 0);

  return (
    <div className="flex flex-col gap-3">
      {resources}
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
          <Card
            key={widget.title}
            title={widget.title}
            action={
              widget.filterable &&
              widget.entries.length > 0 && (
                <FilterButton
                  label={widget.title}
                  active={widget.active}
                  onReset={() => {
                    setRanges((at) => ({ ...at, [widget.title]: NO_RANGE }));
                    setUsesPicks((at) => ({ ...at, [widget.title]: [] }));
                  }}
                >
                  {widget.byLevel && (
                    <RangeFacet
                      label="Level"
                      range={widget.range}
                      bounds={{ min: 1, max: 20 }}
                      onChange={(next) => setRanges((at) => ({ ...at, [widget.title]: next }))}
                    />
                  )}
                  <CheckFacet
                    label="Limited uses"
                    options={USES_OPTIONS}
                    picked={widget.uses}
                    onChange={(next) => setUsesPicks((at) => ({ ...at, [widget.title]: next }))}
                  />
                </FilterButton>
              )
            }
          >
            {widget.entries.length === 0 ? null : widget.named.length === 0 ? (
              <p className="text-body text-muted italic">
                No {widget.noun} match “{query.trim()}”.
              </p>
            ) : widget.matches.length === 0 ? (
              <p className="text-body text-muted italic">Nothing matches the filter.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {widget.matches.map((entry, index) => (
                  <FeatureRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: one name can recur at several levels, and nothing reorders the list.
                    key={index}
                    {...entry}
                    character={character}
                    featIndex={
                      entry.group.origin === "feat"
                        ? entry.group.features.indexOf(entry.feature)
                        : undefined
                    }
                  />
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
