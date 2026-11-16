import { ABILITIES, ABILITY_LABEL } from "@dnd/rules";

type Ability = (typeof ABILITIES)[number];

type Node = { name?: unknown; entries?: unknown; items?: unknown };

const printed = new Map<string, Ability>(
  ABILITIES.map((ability) => [ABILITY_LABEL[ability], ability]),
);

function find(nodes: unknown): Ability | undefined {
  if (!Array.isArray(nodes)) return undefined;
  for (const node of nodes as (Node | string)[]) {
    if (typeof node === "string") continue;
    const [text] = Array.isArray(node.entries) ? node.entries : [];
    if (node.name === "Ability:" && typeof text === "string") return printed.get(text);
    const inner = find(node.items) ?? find(node.entries);
    if (inner) return inner;
  }
  return undefined;
}

/** The ability a 2024 tool's text prints as `Ability:`; the 2014 books print none, so absent. */
export function toolAbility(json: { entries?: unknown }): Ability | undefined {
  return find(json.entries);
}
