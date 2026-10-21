import { type EntryRef, entryKey, HIT_DICE, type HitDie } from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { classQuery } from "./classQuery.ts";
import { homebrewClassQuery } from "./homebrewClassQuery.ts";

/**
 * Each level's hit die, in order, or `undefined` until every class the levels name has
 * loaded with a die the sheet counts hit points on.
 */
export function useLevelDice(levels: readonly { class: EntryRef }[]): HitDie[] | undefined {
  const classes = [...new Map(levels.map(({ class: cls }) => [entryKey(cls), cls])).values()];
  const catalog = useQueries({
    queries: classes.map((cls) => classQuery("name" in cls ? cls : undefined)),
  });
  const homebrew = useQueries({
    queries: classes.map((cls) =>
      homebrewClassQuery("homebrewId" in cls ? cls.homebrewId : undefined),
    ),
  });
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
