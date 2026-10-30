import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { FeatGrantField } from "./FeatGrantField.tsx";
import { BACKGROUND_GRANT_SPECS, type BackgroundGrantKey } from "./featGrantShapes.ts";
import { type HomebrewFormProps, withField } from "./homebrewEntry.ts";
import { byName, type Option } from "./homebrewOptions.ts";
import { SKILL_NAMES } from "./homebrewVocabulary.ts";

const SKILLS = SKILL_NAMES.map((name) => ({ value: name.toLowerCase(), label: name }));

/**
 * The skills, tools and languages a homebrew background grants, each named from the
 * background's edition: the skills both editions share, and the tools and languages of the
 * catalog and homebrew, which load as the step opens.
 */
export function BackgroundProficiencies({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const search = { edition, query: "", limit: 200, listAll: true };
  const tools = useCatalogSearch({
    ...search,
    type: "item",
    filters: { kind: "tool", rarity: "none" },
  });
  const languages = useCatalogSearch({ ...search, type: "language" });
  const loading = (pending: boolean, noun: string) => pending && `Loading the ${noun}…`;
  const fields: [BackgroundGrantKey, string, string, Option[], string | false][] = [
    ["skillProficiencies", "Skills", "skills", SKILLS, false],
    [
      "toolProficiencies",
      "Tools",
      "tools",
      byName(tools.data?.items ?? []),
      loading(tools.isPending, "tools"),
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
          owner="background"
          label={label}
          noun={noun}
          options={options}
          spec={BACKGROUND_GRANT_SPECS[key]}
          value={entry[key]}
          onChange={(next) => onChange(withField(entry, key, next))}
          error={errorFor(key)}
          status={status || undefined}
        />
      ))}
    </div>
  );
}
