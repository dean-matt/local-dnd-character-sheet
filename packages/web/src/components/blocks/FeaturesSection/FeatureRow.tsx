import type { FeatureGroup, FeatureOrigin, SheetFeature } from "@dnd/catalog";
import type { CatalogKind, CharacterDerived, CharacterRecord, ContentRef } from "@dnd/character";
import { featureTypeLabel } from "../../../lib/featureTypeLabel.ts";
import { renamedRef } from "../../../lib/renamed.ts";
import { firstLine } from "../../../lib/rulesProse.ts";
import { ListRow } from "../../ListRow/ListRow.tsx";
import { NotFoundTag } from "../../NotFoundTag.tsx";
import { RulesEntries } from "../../RulesEntries/RulesEntries.tsx";
import { Tag } from "../../Tag.tsx";
import { FeatureDc } from "../FeatureDc.tsx";
import { FeatPicks } from "./FeatPicks.tsx";
import { FeatureChoiceField } from "./FeatureChoiceField.tsx";
import { FeatureEffect } from "./FeatureEffect.tsx";
import { FeatureHomebrewEffect } from "./FeatureHomebrewEffect.tsx";
import { FeaturePicks } from "./FeaturePicks.tsx";
import { FeatureUses } from "./FeatureUses.tsx";

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

/** The control that changes a feature's choice, picks, or a feat's own picks, where it has one. */
function featureControls(
  feature: Extract<SheetFeature, { resolved: true }>,
  character: CharacterRecord,
  featIndex: number | undefined,
) {
  if (feature.choice) return <FeatureChoiceField character={character} choice={feature.choice} />;
  if (feature.picks) {
    return <FeaturePicks character={character} name={feature.name} picks={feature.picks} />;
  }
  return featIndex !== undefined && <FeatPicks character={character} index={featIndex} />;
}

/** The element of a derived list naming the feature `name` from `source`, if one does. */
const findHeld = <T extends ContentRef>(
  list: readonly T[] | undefined,
  name: string,
  source: string | undefined,
) => list?.find((ref) => ref.name === name && ref.source === source);

/** Whether starting the feature's effect gives temporary hit points, which its spend then must not. */
const givesTempHp = (
  derived: CharacterDerived | undefined,
  name: string,
  source: string | undefined,
  startable: ContentRef | undefined,
) =>
  startable !== undefined &&
  derived?.featureRestores.some(
    ({ feature, kind }) => kind === "tempHp" && feature.name === name && feature.source === source,
  ) === true;

/**
 * An unresolved feature with no source is a homebrew reference, which names no source. A
 * feature that offers a choice of features carries the control that changes it, and a feat
 * the controls for what its own fields offer. A feature with limited uses carries its uses
 * left and the controls that spend them, and one whose effect runs the control that starts
 * and ends it. `featIndex` is a feat's place in `feats`.
 */
export function FeatureRow({
  feature,
  group,
  character,
  derived,
  featIndex,
}: Entry & {
  character: CharacterRecord;
  derived: CharacterDerived | undefined;
  featIndex?: number;
}) {
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
  const controls = featureControls(feature, character, featIndex);
  const { source } = feature;
  const startable = findHeld(derived?.startableFeatures, feature.name, source);
  const startsRestore = givesTempHp(derived, feature.name, source, startable);
  const homebrew = derived?.homebrewEffects.some(
    (ref) => ref.name === feature.name && ref.source === source,
  );
  const hasDc = derived?.featureDcs.some(
    ({ feature: held }) => held.name === feature.name && held.source === source,
  );
  return (
    <ListRow
      name={feature.name}
      source={feature.source}
      chips={
        <>
          {chips}
          {homebrew && <Tag>Homebrew effect</Tag>}
        </>
      }
      preview={firstLine(feature.entries)}
      controls={
        (feature.uses || controls || startable || hasDc) && (
          <>
            <FeatureDc
              character={character}
              derived={derived}
              name={feature.name}
              source={feature.source}
            />
            {[feature.uses, ...(feature.otherUses ?? [])].map(
              (uses) =>
                uses && (
                  <FeatureUses
                    key={uses.key}
                    characterId={character.id}
                    derived={derived}
                    name={feature.name}
                    source={feature.source}
                    uses={uses}
                    startsRestore={startsRestore}
                  />
                ),
            )}
            {startable && derived && (
              <FeatureEffect
                character={character}
                derived={derived}
                startable={startable}
                uses={feature.uses}
                group={group}
              />
            )}
            {controls}
          </>
        )
      }
      detail={{
        meta: [
          group.name ?? ORIGIN_LABEL[group.origin],
          level === undefined ? undefined : `Level ${level}`,
          type,
        ]
          .filter((part) => part !== undefined)
          .join(" • "),
        children: (
          <>
            <RulesEntries entries={feature.entries} />
            {source !== undefined && (
              <FeatureHomebrewEffect
                feature={{ name: feature.name, source }}
                origin={group.origin}
                applied={homebrew}
              />
            )}
          </>
        ),
      }}
    />
  );
}
