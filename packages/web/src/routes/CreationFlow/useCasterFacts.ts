import { preparationRuleSchema, spellcastingAbilitySchema } from "@dnd/catalog";
import {
  abilityModifier,
  abilityScore,
  type CharacterDefinition,
  type ContentRef,
} from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useClassGrants } from "../../hooks/useClassGrants.ts";
import { useSubclassGrants } from "../../hooks/useSubclassGrants.ts";
import { type CasterFacts, casterFacts } from "./spellPicks.ts";
import { useClassEntries } from "./useClassEntries.ts";

/** The modifier of `ability` the draft's scores give, 0 before any score is set. */
function useModifier(ability: Parameters<typeof abilityScore>[1] | undefined): number {
  const [scores, increases] = useWatch<CharacterDefinition, ["abilityScores", "abilityIncreases"]>({
    name: ["abilityScores", "abilityIncreases"],
  });
  if (!ability || !scores) return 0;
  return abilityModifier(
    abilityScore({ abilityScores: scores, abilityIncreases: increases ?? [] }, ability),
  );
}

/** A homebrew class casts every level, with no count, where it states a casting ability. */
const homebrewFacts = (json: unknown): CasterFacts | undefined =>
  spellcastingAbilitySchema.parse(json) ? { prepares: false, maxLevel: 9 } : undefined;

/** What a catalog class casts at `level`, and whether its tables have loaded. */
function useCatalogCaster(
  cls: ContentRef | undefined,
  subclass: ContentRef | undefined,
  level: number,
  subclassJson: unknown,
  classJson: unknown,
) {
  const classGrants = useClassGrants(cls, level);
  const subclassGrants = useSubclassGrants(cls, subclass, level);
  const ability =
    (classJson ? spellcastingAbilitySchema.parse(classJson) : undefined) ??
    (subclassJson ? spellcastingAbilitySchema.parse(subclassJson) : undefined);
  const modifier = useModifier(ability);
  const rule = classJson ? preparationRuleSchema.parse(classJson) : undefined;
  // The row as well as the tables: a 2014 preparer reads as a knower until its formula loads.
  const ready =
    classJson !== undefined &&
    classGrants.data !== undefined &&
    (!subclass || subclassGrants.data !== undefined);
  const tables = [classGrants.data, subclassGrants.data].flatMap((table) => table ?? []);
  const failed = classGrants.isError || subclassGrants.isError;
  const states = (...keys: string[]) =>
    (subclassGrants.data?.resources ?? []).some((each) => keys.includes(each.resourceKey));
  return {
    ready,
    failed,
    subclassStates: {
      cantrips: states("cantrips_known"),
      spells: states("spells_known", "prepared_spells"),
    },
    facts: ready ? casterFacts(tables, rule && { rule, modifier, level }) : undefined,
  };
}

/**
 * What the draft's first class casts at its own level, read off its table and its
 * subclass's, with the class's list as `/search` narrows by it. `facts` is `undefined` for a
 * class that casts nothing, `ready` false until the rows it reads have loaded, and `failed` true once
 * one of them fails to. `subclassStates` says which counts the subclass's table states.
 */
export function useCasterFacts() {
  const first = useClassEntries().entries[0];
  const catalogClass = first?.catalogClass;
  const level = Math.max(1, first?.level ?? 0);
  const subclass = first?.subclass;
  const subclassRow = first?.subclasses?.find(
    (row) => subclass && row.name === subclass.name && row.source === subclass.source,
  );
  const catalog = useCatalogCaster(
    catalogClass,
    subclass,
    level,
    subclassRow?.json,
    catalogClass && first.json,
  );
  const { ready, facts } = catalogClass
    ? catalog
    : {
        ready: first?.json !== undefined,
        facts: first?.json === undefined ? undefined : homebrewFacts(first.json),
      };
  return {
    subclassStates: catalog.subclassStates,
    ready: first !== undefined && ready,
    failed: catalog.failed || first?.failed === true,
    classless: first === undefined,
    className: first?.name ?? "The class",
    level,
    facts,
    list: catalogClass && { class: catalogClass, ...(subclass && { subclass }), level },
  };
}
