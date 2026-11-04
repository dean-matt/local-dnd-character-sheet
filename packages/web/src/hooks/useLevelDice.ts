import {
  type CharacterDefinition,
  type EntryRef,
  entryKey,
  HIT_DICE,
  type HitDie,
} from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { catalogClass } from "../lib/catalogClass.ts";
import { classQuery } from "./classQuery.ts";
import { homebrewClassQuery } from "./homebrewClassQuery.ts";
import { useHomebrewClassIds } from "./useHomebrewClassIds.ts";

/**
 * Each level's hit die, in order, or `undefined` until every class the levels name has
 * loaded with a die the sheet counts hit points on.
 */
export function useLevelDice(
  levels: readonly { class: EntryRef }[],
  edition: CharacterDefinition["edition"],
): HitDie[] | undefined {
  const classes = [...new Map(levels.map(({ class: cls }) => [entryKey(cls), cls])).values()];
  const catalog = useQueries({ queries: classes.map((cls) => classQuery(catalogClass(cls))) });
  const { ids } = useHomebrewClassIds(classes, edition);
  const homebrew = useQueries({ queries: ids.map((id) => homebrewClassQuery(id)) });
  const dieOf = new Map(
    classes.map((cls, index) => [
      entryKey(cls),
      catalog[index]?.data?.hitDie ?? homebrew[index]?.data?.hitDie,
    ]),
  );
  const dice = levels.map(({ class: cls }) =>
    HIT_DICE.find((die) => die === dieOf.get(entryKey(cls))),
  );
  return dice.every((die) => die !== undefined) ? (dice as HitDie[]) : undefined;
}
