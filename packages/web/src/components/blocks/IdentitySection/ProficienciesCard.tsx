import type { SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, type CharacterRecord, proficiencyKey } from "@dnd/character";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { AddChoice } from "../../AddChoice.tsx";
import { Card } from "../../Card.tsx";
import { CatalogPicker } from "../../CatalogPicker/CatalogPicker.tsx";
import { RemovableChipList } from "../../RemovableChipList.tsx";
import { ProficiencyGroup } from "./ProficiencyGroup.tsx";

type Proficiencies = CharacterDefinition["proficiencies"];

/** The categories upstream grants by name, as `titleCase` stores them. */
const ARMOR = ["Light", "Medium", "Heavy", "Shield"];
const WEAPON_CATEGORIES = ["Simple", "Martial"];

/** A tool held at `none` grants nothing, so it earns no chip. */
const TOOL_SUFFIX = { none: undefined, half: " (half)", proficient: "", expertise: " (expertise)" };

/** `names` with `name` added, unless it is there in any spelling the sheet reads as the same. */
const withName = (names: string[], name: string) =>
  names.some((each) => proficiencyKey(each) === proficiencyKey(name)) ? names : [...names, name];

const withoutName = (names: string[], name: string) => names.filter((each) => each !== name);

/**
 * Armor, weapons and tools, each removed with ×. Armor and weapon categories are added from
 * their fixed lists, a single weapon or a tool through the picker. A tool added at a level
 * of `none` is raised to proficient rather than listed twice.
 */
export function ProficienciesCard({ character }: { character: CharacterRecord }) {
  const { proficiencies, edition } = character.definition;
  const write = useHeldSave(character.id, "Proficiencies");
  const edit = (key: string, change: (held: Proficiencies) => Partial<Proficiencies>) =>
    write(key, (latest) => ({
      ...latest,
      proficiencies: { ...latest.proficiencies, ...change(latest.proficiencies) },
    }));
  const holds = (names: string[]) => new Set(names.map(proficiencyKey));
  const missing = (names: string[], from: string[]) =>
    from
      .filter((name) => !holds(names).has(proficiencyKey(name)))
      .map((name) => ({ value: name, label: name }));
  const tools = proficiencies.tools.flatMap(({ name, level }) => {
    const suffix = TOOL_SUFFIX[level];
    return suffix === undefined ? [] : [{ key: name, label: `${name}${suffix}`, name }];
  });
  const heldTools = holds(tools.map((tool) => tool.name));
  const unavailableIn = (names: Set<string>) => (hit: SearchHit) =>
    names.has(proficiencyKey(hit.name)) ? "Already proficient" : undefined;
  // `Light` names an armor and a weapon category both, so × names the group too.
  const chips = (names: string[], group: string) =>
    names.map((name) => ({ key: name, label: name, name: `${name} (${group})` }));

  return (
    // Armor and weapons are categories, and `Light` names one of each, so each keeps a heading.
    <Card title="Proficiencies">
      <div className="flex flex-col gap-2">
        <ProficiencyGroup heading="Armor">
          <div className="flex flex-col gap-1.5">
            <RemovableChipList
              items={chips(proficiencies.armor, "armor")}
              onRemove={(name) =>
                edit(`armor|${name}`, (held) => ({ armor: withoutName(held.armor, name) }))
              }
              empty="No armor."
            />
            <AddChoice
              label="Add armor"
              options={missing(proficiencies.armor, ARMOR)}
              onAdd={(name) =>
                edit(`armor|${name}`, (held) => ({ armor: withName(held.armor, name) }))
              }
            />
          </div>
        </ProficiencyGroup>
        <ProficiencyGroup heading="Weapons">
          <div className="flex flex-col gap-1.5">
            <RemovableChipList
              items={chips(proficiencies.weapons, "weapons")}
              onRemove={(name) =>
                edit(`weapons|${name}`, (held) => ({ weapons: withoutName(held.weapons, name) }))
              }
              empty="No weapons."
            />
            <AddChoice
              label="Add weapon category"
              options={missing(proficiencies.weapons, WEAPON_CATEGORIES)}
              onAdd={(name) =>
                edit(`weapons|${name}`, (held) => ({ weapons: withName(held.weapons, name) }))
              }
            />
            <CatalogPicker
              label="Add a weapon"
              edition={edition}
              type="item"
              filters={{ kind: "melee,ranged", rarity: "none" }}
              unavailableReason={unavailableIn(holds(proficiencies.weapons))}
              onPick={(_, hit) =>
                edit(`weapons|${hit.name}`, (held) => ({
                  weapons: withName(held.weapons, hit.name),
                }))
              }
            />
          </div>
        </ProficiencyGroup>
        <ProficiencyGroup heading="Tools">
          <div className="flex flex-col gap-1.5">
            <RemovableChipList
              items={tools}
              onRemove={(name) =>
                edit(`tools|${name}`, (held) => ({
                  tools: held.tools.filter((tool) => tool.name !== name),
                }))
              }
              empty="No tools."
            />
            <CatalogPicker
              label="Add a tool"
              edition={edition}
              type="item"
              filters={{ kind: "tool", rarity: "none" }}
              unavailableReason={unavailableIn(heldTools)}
              onPick={(_, { name }) =>
                edit(`tools|${name}`, (held) => {
                  const same = (tool: { name: string }) =>
                    proficiencyKey(tool.name) === proficiencyKey(name);
                  const kept = held.tools.find(same);
                  if (kept && kept.level !== "none") return {};
                  return {
                    tools: [
                      ...held.tools.filter((tool) => !same(tool)),
                      { name, level: "proficient" },
                    ],
                  };
                })
              }
            />
          </div>
        </ProficiencyGroup>
      </div>
    </Card>
  );
}
