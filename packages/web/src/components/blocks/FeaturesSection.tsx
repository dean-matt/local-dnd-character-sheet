/**
 * The Features page: what the character has gained, one group per grantor. Each feature
 * is a collapsed row that opens onto its rules text, and a filter narrows every group by
 * name, so a reader looking for one feature skips the rest.
 */
import type { FeatureGroup, FeatureOrigin, SheetFeature } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { useId, useState } from "react";
import { useCharacterFeatures } from "../../hooks/useCharacterFeatures.ts";
import { EmptyState, ErrorState, LoadingState } from "../../states.tsx";
import { RulesEntries } from "../RulesText.tsx";

const ORIGIN_LABEL: Record<FeatureOrigin, string> = {
  class: "Class",
  subclass: "Subclass",
  race: "Race",
  background: "Background",
  feat: "Feats",
  optionalFeature: "Optional features",
};

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

function Placement({ feature }: { feature: SheetFeature }) {
  const parts = [
    feature.level === undefined ? undefined : `Level ${feature.level}`,
    feature.featureType === undefined
      ? undefined
      : (FEATURE_TYPE_LABEL[feature.featureType] ?? feature.featureType),
  ].filter((part) => part !== undefined);
  if (parts.length === 0) return null;
  return <span className="text-muted text-row">{parts.join(" · ")}</span>;
}

/** An unresolved feature with no source is a homebrew reference, which names no source. */
function FeatureRow({ feature }: { feature: SheetFeature }) {
  if (!feature.resolved) {
    const source = feature.source ? ` (${feature.source})` : "";
    return (
      <li className="flex flex-wrap items-baseline gap-x-2 py-1">
        <span>
          {feature.name}
          {source}
        </span>
        <Placement feature={feature} />
        <span className="text-muted text-row">
          {feature.source ? "Not found in the catalog" : "Not found in homebrew"}
        </span>
      </li>
    );
  }
  return <ResolvedFeatureRow feature={feature} />;
}

/**
 * The text mounts on first open, because each feature's rules text is a block that
 * resolves its references in a request of its own.
 */
function ResolvedFeatureRow({ feature }: { feature: Extract<SheetFeature, { resolved: true }> }) {
  const [opened, setOpened] = useState(false);
  return (
    <li>
      <details
        className="group py-1"
        onToggle={(event) => event.currentTarget.open && setOpened(true)}
      >
        <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2">
          <span aria-hidden="true" className="text-muted group-open:rotate-90 print:hidden">
            ▸
          </span>
          <span className="font-medium">{feature.name}</span>
          <Placement feature={feature} />
        </summary>
        <div className="mt-2 flex flex-col gap-2 pl-4">
          {opened && <RulesEntries entries={feature.entries} />}
        </div>
      </details>
    </li>
  );
}

function Group({ group }: { group: FeatureGroup }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-card border border-border bg-surface p-4">
      <h3 id={id} className="font-semibold">
        {group.name ?? ORIGIN_LABEL[group.origin]}
        {group.name && (
          <span className="ml-2 font-normal text-muted text-row">
            <span className="sr-only">,</span> {ORIGIN_LABEL[group.origin]}
          </span>
        )}
      </h3>
      <ul className="mt-2 divide-y divide-border">
        {group.features.map((feature, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one name can recur at several levels, and nothing reorders the list.
          <FeatureRow key={index} feature={feature} />
        ))}
      </ul>
    </section>
  );
}

export function FeaturesSection({ character }: { character: CharacterRecord | undefined }) {
  const features = useCharacterFeatures(character?.id ?? "");
  const [query, setQuery] = useState("");
  const inputId = useId();

  if (!character) return <EmptyState>Features isn't available yet.</EmptyState>;
  if (features.isPending) return <LoadingState label="Loading features…" />;
  if (features.isError) return <ErrorState message={features.error.message} />;

  const needle = query.trim().toLowerCase();
  const groups = features.data.groups
    .map((group) => ({
      ...group,
      features: group.features.filter((feature) => feature.name.toLowerCase().includes(needle)),
    }))
    .filter((group) => group.features.length > 0);

  const emptyMessage = `No feature matches “${query.trim()}”.`;

  if (features.data.groups.length === 0) {
    return <EmptyState>{character.name} has no features yet.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 print:hidden">
        <label htmlFor={inputId} className="text-muted text-row">
          Find a feature
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-card border border-border bg-surface px-2 py-1"
        />
      </div>
      {groups.length === 0 && (
        <p aria-hidden="true" className="text-muted text-row">
          {emptyMessage}
        </p>
      )}
      {/* Rendered even while empty: a live region added with its text is often not announced. */}
      <p role="status" aria-live="polite" className="sr-only">
        {groups.length === 0 ? emptyMessage : ""}
      </p>
      {groups.map((group) => (
        <Group key={`${group.origin}|${group.name ?? ""}`} group={group} />
      ))}
    </div>
  );
}
