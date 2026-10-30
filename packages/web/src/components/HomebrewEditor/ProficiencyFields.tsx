import { useBaseWeapons } from "../../hooks/useBaseWeapons.ts";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { FeatGrantField } from "./FeatGrantField.tsx";
import type { FeatGrantKey, GrantSpec } from "./featGrantShapes.ts";
import { type HomebrewFormProps, withField } from "./homebrewEntry.ts";
import { byName, type Option } from "./homebrewOptions.ts";
import { ARMOR, SKILLS, WEAPON_PROFICIENCIES } from "./homebrewVocabulary.ts";

type ProficiencySpecs = Partial<Record<FeatGrantKey, GrantSpec>>;

/**
 * The skills, expertise, tools, armor, weapons and languages `specs` names, each named from
 * the entry's edition: the skills both editions share, and the tools, languages and base
 * weapons of the catalog and homebrew, which load as the step opens.
 */
export function ProficiencyFields({
  entry,
  edition,
  onChange,
  errorFor,
  specs,
  owner,
}: HomebrewFormProps & { specs: ProficiencySpecs; owner?: string }) {
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
        ...WEAPON_PROFICIENCIES,
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
      {fields
        .flatMap(([key, label, noun, options, status]) => {
          const spec = specs[key];
          return spec ? [[key, label, noun, options, status, spec] as const] : [];
        })
        .map(([key, label, noun, options, status, spec]) => (
          <FeatGrantField
            key={key}
            owner={owner}
            label={label}
            noun={noun}
            options={options}
            spec={spec}
            value={entry[key]}
            onChange={(next) => onChange(withField(entry, key, next))}
            error={errorFor(key)}
            status={status || undefined}
          />
        ))}
    </div>
  );
}
