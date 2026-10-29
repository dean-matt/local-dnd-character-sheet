import type { SearchHit } from "@dnd/catalog";
import { useBaseWeapons } from "../../hooks/useBaseWeapons.ts";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { FeatGrantField } from "./FeatGrantField.tsx";
import { FEAT_GRANT_SPECS, type FeatGrantKey } from "./featGrantShapes.ts";
import { type HomebrewFormProps, withField } from "./homebrewEntry.ts";
import { SKILL_NAMES } from "./homebrewVocabulary.ts";

type Option = { value: string; label: string };

const SKILLS = SKILL_NAMES.map((name) => ({ value: name.toLowerCase(), label: name }));

const ARMOR = [
  { value: "light", label: "Light armor" },
  { value: "medium", label: "Medium armor" },
  { value: "heavy", label: "Heavy armor" },
  { value: "shield", label: "Shields" },
];

const WEAPON_CATEGORIES = [
  { value: "simple", label: "Simple weapons" },
  { value: "martial", label: "Martial weapons" },
];

/** Each hit once by its lowercased name, as upstream keys a proficiency. */
const byName = (hits: readonly SearchHit[]): Option[] => {
  const seen = new Set<string>();
  return hits.flatMap(({ name }) => {
    const value = name.toLowerCase();
    return seen.has(value) || !seen.add(value) ? [] : [{ value, label: name }];
  });
};

/**
 * The skills, expertise, tools, armor, weapons and languages a homebrew feat grants, each
 * named from the feat's edition: the skills both editions share, and the tools, languages and
 * base weapons of the catalog and homebrew, which load as the step opens.
 */
export function FeatProficiencies({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const search = { edition, query: "", limit: 200, listAll: true };
  const tools = useCatalogSearch({
    ...search,
    type: "item",
    filters: { kind: "tool", rarity: "none" },
  });
  const languages = useCatalogSearch({ ...search, type: "language" });
  const weapons = useBaseWeapons(edition);
  const loading = (pending: boolean, noun: string) => pending && `Loading the ${noun}…`;
  const fields: [FeatGrantKey, string, string, Option[], string | false][] = [
    ["skillProficiencies", "Skills", "skills", SKILLS, false],
    ["expertise", "Expertise", "skills", SKILLS, false],
    [
      "toolProficiencies",
      "Tools",
      "tools",
      byName(tools.data?.items ?? []),
      loading(tools.isPending, "tools"),
    ],
    ["armorProficiencies", "Armor", "armor", ARMOR, false],
    [
      "weaponProficiencies",
      "Weapons",
      "weapons",
      [
        ...WEAPON_CATEGORIES,
        ...(weapons.data?.items ?? []).map(({ name, source }) => ({
          value: `${name}|${source}`.toLowerCase(),
          label: name,
        })),
      ],
      loading(weapons.isPending, "weapons"),
    ],
    [
      "languageProficiencies",
      "Languages",
      "languages",
      byName(languages.data?.items ?? []),
      loading(languages.isPending, "languages"),
    ],
  ];
  return (
    <div className="flex flex-col gap-4">
      {fields.map(([key, label, noun, options, status]) => (
        <FeatGrantField
          key={key}
          label={label}
          noun={noun}
          options={options}
          spec={FEAT_GRANT_SPECS[key]}
          value={entry[key]}
          onChange={(next) => onChange(withField(entry, key, next))}
          error={errorFor(key)}
          status={status || undefined}
        />
      ))}
    </div>
  );
}
