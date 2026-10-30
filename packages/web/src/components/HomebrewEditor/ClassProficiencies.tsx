import { useBaseWeapons } from "../../hooks/useBaseWeapons.ts";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { MultiSelect } from "../MultiSelect.tsx";
import {
  CLASS_SKILL_SPEC,
  type ProficiencyList,
  proficienciesIn,
  readNames,
  withProficiencies,
  writeNames,
} from "./classShapes.ts";
import { FeatGrantField } from "./FeatGrantField.tsx";
import type { HomebrewFormProps } from "./homebrewEntry.ts";
import { FORM_GRID, PAIRED, WHOLE } from "./homebrewGrid.ts";
import { byName, withValues } from "./homebrewOptions.ts";
import { ARMOR, SKILLS, WEAPON_PROFICIENCIES } from "./homebrewVocabulary.ts";

/**
 * The armor, weapons and tools a homebrew class grants and the skills it offers a pick of:
 * those of a character who starts in it, or those `gained` by one who multiclasses into it.
 */
export function ClassProficiencies({
  entry,
  edition,
  onChange,
  errorFor,
  gained = false,
  skillsError,
}: HomebrewFormProps & { gained?: boolean; skillsError?: string }) {
  const tools = useCatalogSearch({
    edition,
    query: "",
    limit: 200,
    listAll: true,
    type: "item",
    filters: { kind: "tool", rarity: "none" },
  });
  const weapons = useBaseWeapons(edition);
  const container = proficienciesIn(entry, gained) ?? {};
  const lists: [ProficiencyList, string, string, { value: string; label: string }[]][] = [
    ["armor", "Armor", "armor", ARMOR],
    [
      "weapons",
      "Weapons",
      "weapons",
      [
        ...WEAPON_PROFICIENCIES,
        ...(weapons.data?.items ?? []).map(({ name }) => ({
          value: name.toLowerCase(),
          label: name,
        })),
      ],
    ],
    ["tools", "Tools", "tools", byName(tools.data?.items ?? [])],
  ];
  const unreadable = lists.filter(([list]) => readNames(container, list) === undefined);
  return (
    <div className={FORM_GRID}>
      {lists.map(([list, label, noun, options]) => {
        const names = readNames(container, list);
        if (!names) return null;
        return (
          <div key={list} className={PAIRED}>
            <MultiSelect
              inForm
              label={label}
              noun={noun}
              options={withValues(options, names)}
              selected={names}
              onChange={(next) =>
                onChange(withProficiencies(entry, gained, writeNames(container, list, next)))
              }
            />
          </div>
        );
      })}
      {unreadable.map(([list, label]) => (
        <p key={list} className={`${WHOLE} text-muted text-row`}>
          This class states its {label.toLowerCase()} in a shape the form cannot show. Edit them in
          JSON.
        </p>
      ))}
      <div className={WHOLE}>
        <FeatGrantField
          label="Skills"
          noun="skills"
          owner="class"
          options={SKILLS}
          spec={CLASS_SKILL_SPEC}
          modes={["none", "list", "any"]}
          value={container.skills}
          onChange={(next) => {
            const { skills: _skills, ...rest } = container;
            onChange(withProficiencies(entry, gained, next ? { ...rest, skills: next } : rest));
          }}
          error={gained ? skillsError : errorFor("startingProficiencies")}
        />
      </div>
    </div>
  );
}
