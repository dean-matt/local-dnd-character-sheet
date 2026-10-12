import type { FeatureGroup, FeatureOrigin, SheetFeature } from "@dnd/catalog";
import type { CatalogKind, CharacterRecord } from "@dnd/character";
import { featureTypeLabel } from "../../../lib/featureTypeLabel.ts";
import { renamedRef } from "../../../lib/renamed.ts";
import { firstLine } from "../../../lib/rulesProse.ts";
import { ListRow } from "../../ListRow/ListRow.tsx";
import { NotFoundTag } from "../../NotFoundTag.tsx";
import { RulesEntries } from "../../RulesEntries/RulesEntries.tsx";
import { Tag } from "../../Tag.tsx";
import { FeatureChoiceField } from "./FeatureChoiceField.tsx";

/** Names a grantor in the modal where the group carries no name of its own. */
const ORIGIN_LABEL: Record<FeatureOrigin, string> = {
  class: "Class",
  subclass: "Subclass",
  race: "Race",
  background: "Background",
  feat: "Feat",
  optionalFeature: "Optional feature",
};

type Entry = { feature: SheetFeature; group: FeatureGroup };

/** The catalog tables an unresolved feature's own reference may name, by its group. */
const ORIGIN_KINDS: Record<FeatureOrigin, readonly CatalogKind[]> = {
  class: ["class"],
  subclass: ["subclass"],
  race: ["race", "subrace"],
  background: ["background"],
  feat: ["feat"],
  optionalFeature: ["optionalFeature"],
};

/**
 * An unresolved feature with no source is a homebrew reference, which names no source. A
 * feature that offers a choice of features carries the control that changes it.
 */
export function FeatureRow({ feature, group, character }: Entry & { character: CharacterRecord }) {
  const type =
    feature.featureType === undefined ? undefined : featureTypeLabel(feature.featureType);
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
        <NotFoundTag
          characterId={character.id}
          homebrew={!feature.source}
          renamed={renamedRef(ORIGIN_KINDS[group.origin], {
            name: feature.name,
            source: feature.source ?? "",
          })}
        />
      )}
    </>
  );
  if (!feature.resolved) {
    return <ListRow name={feature.name} source={feature.source} chips={chips} />;
  }
  return (
    <ListRow
      name={feature.name}
      source={feature.source}
      chips={chips}
      preview={firstLine(feature.entries)}
      controls={
        feature.choice && <FeatureChoiceField character={character} choice={feature.choice} />
      }
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
