/**
 * The Features page: what the character has gained, in one card each for class, race,
 * background and chosen features. Each feature is a row whose name opens its rules text
 * in a modal, and a search narrows every card by name, so a reader looking for one
 * feature skips the rest.
 */
import type { FeatureGroup, FeatureOrigin, SheetFeature } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { useId, useState } from "react";
import { useCharacterFeatures } from "../../hooks/useCharacterFeatures.ts";
import { EmptyState, ErrorState, LoadingState } from "../../states.tsx";
import { Card } from "../Card.tsx";
import { ListRow } from "../ListRow.tsx";
import { firstLine, RulesBlock, RulesEntries } from "../RulesText.tsx";
import { Tag } from "../Tag.tsx";

/** Names a grantor in the modal where the group carries no name of its own. */
const ORIGIN_LABEL: Record<FeatureOrigin, string> = {
  class: "Class",
  subclass: "Subclass",
  race: "Race",
  background: "Background",
  feat: "Feat",
  optionalFeature: "Optional feature",
};

const WIDGETS: readonly { title: string; noun: string; origins: readonly FeatureOrigin[] }[] = [
  { title: "Class Features", noun: "class features", origins: ["class", "subclass"] },
  { title: "Race Features", noun: "race features", origins: ["race"] },
  { title: "Background Features", noun: "background features", origins: ["background"] },
  { title: "Chosen Features", noun: "chosen features", origins: ["feat", "optionalFeature"] },
];

/** Upstream's names for the codes an option is picked under. A code not listed shows as itself. */
const FEATURE_TYPE_LABEL: Record<string, string> = {
  AI: "Artificer Infusion",
  AS: "Arcane Shot",
  ED: "Elemental Discipline",
  EI: "Eldritch Invocation",
  "FS:B": "Fighting Style (Bard)",
  "FS:F": "Fighting Style (Fighter)",
  "FS:P": "Fighting Style (Paladin)",
  "FS:R": "Fighting Style (Ranger)",
  MM: "Metamagic",
  "MV:B": "Maneuver (Battle Master)",
  PB: "Pact Boon",
  RN: "Rune Knight Rune",
};

type Entry = { feature: SheetFeature; group: FeatureGroup };

/** An unresolved feature with no source is a homebrew reference, which names no source. */
function FeatureRow({ feature, group }: Entry) {
  const type =
    feature.featureType === undefined
      ? undefined
      : (FEATURE_TYPE_LABEL[feature.featureType] ?? feature.featureType);
  const level = feature.level;
  const chips = (
    <>
      {group.name && <Tag>{group.name}</Tag>}
      {type && <Tag>{type}</Tag>}
      {level !== undefined && (
        <Tag>
          <span aria-hidden="true">Lvl {level}</span>
          <span className="sr-only">Level {level}</span>
        </Tag>
      )}
      {!feature.resolved && (
        <Tag>{feature.source ? "Not found in the catalog" : "Not found in homebrew"}</Tag>
      )}
    </>
  );
  if (!feature.resolved) {
    const source = feature.source ? ` (${feature.source})` : "";
    return <ListRow name={`${feature.name}${source}`} chips={chips} />;
  }
  return (
    <ListRow
      name={feature.name}
      chips={chips}
      preview={firstLine(feature.entries)}
      detail={{
        meta: [
          group.name ?? ORIGIN_LABEL[group.origin],
          level === undefined ? undefined : `Level ${level}`,
          type,
        ]
          .filter((part) => part !== undefined)
          .join(" • "),
        children: <RulesEntries entries={feature.entries} />,
      }}
    />
  );
}

export function FeaturesSection({ character }: { character: CharacterRecord | undefined }) {
  const features = useCharacterFeatures(character?.id ?? "");
  const [query, setQuery] = useState("");
  const inputId = useId();

  if (!character) return <EmptyState>Features isn't available yet.</EmptyState>;
  if (features.isPending) return <LoadingState label="Loading features…" />;
  if (features.isError) return <ErrorState message={features.error.message} />;

  if (features.data.groups.length === 0) {
    return <EmptyState>{character.name} has no features yet.</EmptyState>;
  }

  const needle = query.trim().toLowerCase();
  const widgets = WIDGETS.map((widget) => {
    const entries = features.data.groups
      .filter((group) => widget.origins.includes(group.origin))
      .flatMap((group) => group.features.map((feature) => ({ feature, group })));
    const matches = entries.filter(({ feature }) => feature.name.toLowerCase().includes(needle));
    return { ...widget, entries, matches };
  }).filter((widget) => widget.entries.length > 0);
  const noMatches = widgets.every((widget) => widget.matches.length === 0);

  return (
    <div className="flex flex-col gap-4">
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
          className="w-full rounded-control border border-border bg-surface px-3 py-2 text-body placeholder:text-muted"
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
            {widget.matches.length === 0 ? (
              <p className="text-body text-muted italic">
                No {widget.noun} match “{query.trim()}”.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {widget.matches.map((entry, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: one name can recur at several levels, and nothing reorders the list.
                  <FeatureRow key={index} {...entry} />
                ))}
              </ul>
            )}
          </Card>
        ))}
      </RulesBlock>
    </div>
  );
}
