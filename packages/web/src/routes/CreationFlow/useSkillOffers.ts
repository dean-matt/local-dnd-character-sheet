import {
  backgroundSkillChoiceSchema,
  classSkillChoiceSchema,
  proficiencyGrantsSchema,
  type SkillChoice,
} from "@dnd/catalog";
import { type ContentRef, refKey } from "@dnd/character";
import { catalogRow } from "./grants.ts";
import type { SkillOffer } from "./skillPicks.ts";
import { useClassCatalog } from "./useClassCatalog.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

export type GrantedSkill = { ref: ContentRef; by: "Race" | "Background" };

/**
 * The skills the race and the background grant outright, and the picks the class and the
 * background offer, each resolved against the edition's skill rows. `undefined` while a
 * row they read has not loaded, a failed read included, so a half-read never reads as an
 * offer of nothing.
 */
export function useSkillOffers(): { granted: GrantedSkill[]; offers: SkillOffer[] } | undefined {
  const { edition, catalogRace, raceRow, subraces, raceJson, backgroundRow, backgrounds, names } =
    useIdentityCatalog();
  const { catalogClass, classRow } = useClassCatalog();
  const raceRead = catalogRace === undefined || (raceRow.isSuccess && subraces.isSuccess);
  const classRead = catalogClass === undefined || classRow.isSuccess;
  if (!(raceRead && classRead && backgrounds.isSuccess && names.isSuccess)) return undefined;
  const hits = names.data.items;
  const row = (name: string) => catalogRow(hits, "skill", name, edition);
  const everySkill = [
    ...new Set(hits.flatMap((hit) => (hit.type === "skill" ? [hit.name.toLowerCase()] : []))),
  ];

  const granted = (
    [
      ["Race", raceJson],
      ["Background", backgroundRow?.json],
    ] as const
  ).flatMap(([by, json]) =>
    json
      ? proficiencyGrantsSchema
          .parse(json)
          .skills.flatMap((name) => row(name) ?? [])
          .map((ref) => ({ ref, by }))
      : [],
  );

  const offer = (
    by: SkillOffer["by"],
    name: string,
    choice: SkillChoice | undefined,
  ): SkillOffer[] => {
    if (choice === undefined) return [];
    const options = (choice.from ?? everySkill).flatMap((skill) => row(skill) ?? []);
    const unique = [...new Map(options.map((ref) => [refKey(ref), ref])).values()];
    return [{ by, name, count: choice.count, options: unique }];
  };
  const classJson = classRow.data?.json;
  return {
    granted,
    offers: [
      ...(catalogClass && classJson
        ? offer("Class", catalogClass.name, classSkillChoiceSchema.parse(classJson))
        : []),
      ...(backgroundRow
        ? offer(
            "Background",
            backgroundRow.name,
            backgroundSkillChoiceSchema.parse(backgroundRow.json),
          )
        : []),
    ],
  };
}
