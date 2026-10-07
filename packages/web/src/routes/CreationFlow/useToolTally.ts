import {
  backgroundToolChoicesSchema,
  classToolChoicesSchema,
  proficiencyGrantsSchema,
  type ToolChoice,
  type ToolType,
} from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { titleCase } from "./grants.ts";
import { holdsTool, type ToolGrant, type ToolOffer, tallyTools } from "./toolPicks.ts";
import { useClassCatalog } from "./useClassCatalog.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

const KIND_LABEL: Record<ToolType, string> = {
  artisan: "artisan's tools",
  instrument: "musical instruments",
  gaming: "gaming sets",
  other: "tools",
};

/**
 * The tools the race, the background and the class grant outright, the picks the class
 * and the background offer, each tool named as the edition's catalog names it, and which
 * offer each held tool spends. A tool no catalog row answers, such as `vehicles (land)`,
 * keeps upstream's name. `undefined` while a row they read has not loaded, a failed read
 * included, so a half-read never reads as an offer of nothing.
 */
export function useToolTally() {
  const { edition, catalogRace, raceRow, subraces, raceJson, backgroundRow, backgrounds } =
    useIdentityCatalog();
  const { catalogClass, classRow, grants: classGrants } = useClassCatalog();
  const proficiencies = useWatch<CharacterDefinition, "proficiencies">({ name: "proficiencies" });
  // One edition holds some fifty mundane tools, under the route's 200. Past that, a pick
  // of a kind leaves out the tools beyond the page.
  const tools = useCatalogSearch({
    edition,
    type: "item",
    query: "",
    listAll: true,
    limit: 200,
    filters: { kind: "tool", rarity: "none" },
  });
  const raceRead = catalogRace === undefined || (raceRow.isSuccess && subraces.isSuccess);
  const classRead = catalogClass === undefined || classRow.isSuccess;
  if (!(raceRead && classRead && backgrounds.isSuccess && tools.isSuccess)) return undefined;
  const hits = tools.data.items;
  const named = (name: string) =>
    hits.find((hit) => hit.name.toLowerCase() === name)?.name ?? titleCase(name);

  const granted: ToolGrant[] = [
    ...(
      [
        ["Race", raceJson],
        ["Background", backgroundRow?.json],
      ] as const
    ).flatMap(([by, json]) =>
      json
        ? proficiencyGrantsSchema.parse(json).tools.map((name) => ({ name: named(name), by }))
        : [],
    ),
    ...(classGrants?.tools ?? []).map((name) => ({ name: named(name), by: "Class" as const })),
  ];

  const offer = (by: ToolOffer["by"], name: string, choice: ToolChoice): ToolOffer => {
    const options = [
      ...choice.names.map(named),
      ...hits.flatMap((hit) =>
        hit.item?.tool !== undefined && choice.types.includes(hit.item.tool) ? [hit.name] : [],
      ),
    ].filter((each, index, all) => !holdsTool(all.slice(0, index), each));
    const kind =
      choice.names.length === 0
        ? choice.types.map((type) => KIND_LABEL[type]).join(" or ")
        : undefined;
    return { by, name, count: choice.count, options, ...(kind && { kind }) };
  };
  const classJson = classRow.data?.json;
  const offers = [
    ...(catalogClass && classJson
      ? classToolChoicesSchema
          .parse(classJson)
          .map((choice) => offer("Class", catalogClass.name, choice))
      : []),
    ...(backgroundRow
      ? backgroundToolChoicesSchema
          .parse(backgroundRow.json)
          .map((choice) => offer("Background", backgroundRow.name, choice))
      : []),
  ];
  const held = (proficiencies?.tools ?? []).map((tool) => tool.name);
  return { granted, offers, held, tally: tallyTools(offers, granted, held) };
}
