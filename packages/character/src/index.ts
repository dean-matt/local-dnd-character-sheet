/**
 * The shape of a character, split the way the database is split.
 *
 *   CharacterDefinition   who the character is — stored in `characters.definition`
 *   CharacterState        what is true right now — stored in `character_state.state`
 *   Derived<T>            what the sheet computes, plus the value a user typed
 *                         over it — the computed side is never overwritten
 *
 * Catalog content is referenced by `(name, source)` and never copied, so
 * rebuilding `content.db` updates every character. Homebrew is the exception:
 * nothing else owns it, so it is referenced by its row id.
 *
 * Every object in the package is strict. The sheet reads a definition or a state out of a
 * JSON column, edits it and writes the whole column back, so an open object drops a key
 * it does not name and the next save deletes that key from the database. Refusing the
 * row loses nothing and says so. The derived tree is assembled rather than stored, and
 * strict for the plainer reason: a key nothing named means the caller built it wrong.
 */
export {
  ABILITIES,
  ABILITY_LABEL,
  abilityModifier,
  averageHitPoints,
  experienceThreshold,
  HIT_DICE,
  type HitDie,
  hitPointSource,
  IMPROVEMENT_CAP,
  maxHitPoints,
  preparedSpellCount,
} from "@dnd/rules";
export { abilityScore, abilityScoreBreakdown } from "./abilityScore.ts";
export type {
  AmmunitionTrait,
  ArmorBurdenTrait,
  ArmorTrait,
  CasterTable,
  CharacterCatalog,
  ContainerTrait,
  DefenseTrait,
  ItemAbilityTrait,
  ItemAdvantageTrait,
  ItemBonusTrait,
  ItemDefenseTrait,
  Preparation,
  SkillTrait,
  WeaponTrait,
} from "./catalog.ts";
export { describeChange, SECTION_LABEL, UNDO_LOG_LIMIT, undoLogSchema } from "./changes.ts";
export {
  type CharacterDerived,
  characterDerivedSchema,
  type RollEffectEntry,
} from "./characterDerived.ts";
export { type CharacterFile, characterFileSchema } from "./characterFile.ts";
export {
  abilityScoresSchema,
  type CharacterDefinition,
  type CharacterRecord,
  characterDefinitionSchema,
  characterRecordSchema,
  flatSkillBonusSchema,
  MAX_HIT_POINT_GAIN,
  MAX_LEVEL,
  noteSectionSchema,
} from "./definition.ts";
export {
  deriveCharacter,
  hitPointMaximum,
  passiveSkill,
  proficiencyKey,
  savingThrowModifier,
  skillModifier,
} from "./derive.ts";
export { type Derived, derivedSchema } from "./derivedField.ts";
export type { HouseRule } from "./houseRules.ts";
export {
  IMPROVEMENT_FEAT,
  type Improvement,
  improvementAt,
  improvementGrantor,
  type Raise,
  withImprovement,
  withoutImprovement,
} from "./improvements.ts";
export { deityKey, entryKey, featureKey, itemKey, refKey } from "./keys.ts";
export { carriedWeight, encumberedSpeed } from "./load.ts";
export {
  grantorKey,
  type OptionalFeatureEntitlement,
  type OptionalFeatureTally,
  optionalFeatureEntitlementsSchema,
  optionalFeatureTallies,
  spareEntitlement,
} from "./optionalFeatures.ts";
export { overrideKey } from "./overrides.ts";
export {
  type CharacterPage,
  type CharacterPageRecord,
  characterPageRecordSchema,
  characterPagesSchema,
  degradePageBlock,
  LIST_BLOCK_SOURCES,
  LIST_FACET_SOURCE,
  type ListBlockSource,
  type ListFilter,
  newPageSlug,
  type PageBlock,
  PRESET_PAGES,
  pageTitleSchema,
  SHEET_SECTIONS,
  type SheetSection,
  VALUE_BLOCK_FIELDS,
  type ValueBlockField,
} from "./pages.ts";
export {
  type CatalogKind,
  type CatalogReference,
  type CharacterReferences,
  catalogReferences,
  characterReferencesSchema,
} from "./references.ts";
export {
  type Ability,
  type ContentRef,
  type DeityRef,
  type EntryRef,
  entryRefSchema,
  type FeatureKey,
} from "./refs.ts";
export { derivedValue, houseRule } from "./resolve.ts";
export { effectsOnRoll, netRollEffect } from "./rollEffects.ts";
export {
  type CharacterState,
  type CharacterStateRecord,
  characterStateRecordSchema,
  characterStateSchema,
  defaultCharacterState,
  hitDicePoolSchema,
  resourceSchema,
  spellSlotSchema,
} from "./state.ts";
export {
  classLevelLabel,
  classLevels,
  classSummary,
  displayName,
  raceSummary,
  totalLevel,
} from "./summaries.ts";
