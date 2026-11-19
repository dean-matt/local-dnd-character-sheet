import { type ConversionOption, resourceLabel } from "@dnd/character";

/** A trade in words: `Regain a level 1 slot for 2 sorcery points`. */
export function tradeWords(option: ConversionOption, pool: string) {
  const label = resourceLabel(pool).toLowerCase();
  const points =
    option.points === null
      ? ""
      : ` for ${option.points} ${option.points === 1 ? label.replace(/s$/, "") : label}`;
  if (option.via === "pact") return `Expend the level ${option.level} pact slot${points}`;
  return `${option.via === "refund" ? "Expend" : "Regain"} a level ${option.level} slot${points}`;
}
