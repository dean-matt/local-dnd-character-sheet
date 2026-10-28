import type { Entries } from "@dnd/catalog";
import { capitalize } from "../../lib/capitalize.ts";
import type { Fact } from "../../lib/homebrewOptionFacts.ts";
import { RulesEntries } from "../RulesEntries/RulesEntries.tsx";
import { RulesText } from "../RulesText/RulesText.tsx";
import { SourceChip } from "../SourceChip.tsx";
import { TypeChip } from "../TypeChip.tsx";
import type { HomebrewInput } from "./homebrewKinds.ts";

export interface HomebrewPreviewProps {
  noun: string;
  /** The entry as it stands, once the kind's schema accepts it; absent while it holds a problem. */
  shown: { input: HomebrewInput; facts: Fact[]; entries: Entries } | undefined;
}

/**
 * A homebrew entry as a catalog detail shows its row: the name beside its type, the source
 * and edition, its facts, then its rules text and any higher-level text.
 */
export function HomebrewPreview({ noun, shown }: HomebrewPreviewProps) {
  if (!shown) {
    return <p className="text-muted">Nothing to preview until the {noun} has no problems.</p>;
  }
  const { entries } = shown;
  return (
    <div className="flex flex-col gap-2 text-body leading-normal">
      <div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="font-bold text-title">{shown.input.name}</h3>
          <TypeChip type={noun}>{capitalize(noun)}</TypeChip>
        </div>
        <div className="mt-1 text-muted text-row">
          <SourceChip source={undefined} edition={shown.input.edition} of={noun} />
        </div>
      </div>
      {shown.facts.length > 0 && (
        <dl className="flex flex-col gap-0.5">
          {shown.facts.map(([label, value]) => (
            <div key={label}>
              <dt className="inline font-bold">{label}: </dt>
              <dd className="inline">
                <RulesText text={value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {entries.length > 0 ? (
        <RulesEntries entries={entries} headingLevel={4} />
      ) : (
        <p className="text-muted">No rules text yet.</p>
      )}
    </div>
  );
}
