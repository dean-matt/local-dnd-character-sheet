import { type FeatOffer, featGrantsSchema, type SearchHit } from "@dnd/catalog";
import {
  ABILITIES,
  ABILITY_LABEL,
  type Ability,
  abilityScore,
  type CharacterDefinition,
  type CharacterDerived,
  type CharacterRecord,
  derivedValue,
  entryKey,
  type FeatPick,
  type Raise,
} from "@dnd/character";
import { useCatalogSearch } from "../../../hooks/useCatalogSearch.ts";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { useFeatRows } from "../../../hooks/useFeatRows.ts";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { pickSlots, pickValue, withPick } from "../../../lib/featPicks.ts";
import { alternativesOf, featRow } from "../../../lib/improvementChoice.ts";
import { titleCase } from "../../../lib/proficiencyGrants.ts";
import { FormField } from "../../FormField.tsx";
import { IncreaseFields } from "../../IncreaseFields.tsx";
import { Select } from "../../Select.tsx";

const UNCHOSEN = "Choose one";

type Option = { value: string; label: string };
type Picks = CharacterDefinition["feats"][number]["picks"];

const FIELD_LABEL: Record<FeatPick["field"], string> = {
  savingThrows: "saving throw",
  skills: "skill",
  expertise: "expertise",
  tools: "tool",
  languages: "language",
  resist: "resistance",
};

const option = (pick: FeatPick, label: string): Option => ({ value: pickValue(pick), label });

/** The names a pick of `field` may take where its offer names none. */
function pool(
  field: FeatPick["field"],
  offer: FeatOffer,
  derived: CharacterDerived | undefined,
  record: CharacterRecord,
  hits: { tools: readonly SearchHit[]; languages: readonly SearchHit[] },
): Option[] {
  const skills = derived?.skills.map(({ ref }) => ref.name) ?? [];
  const granted = derived
    ? [...derivedValue(derived.featGrants).skills, ...derivedValue(derived.itemGrants).skills]
    : [];
  const proficient = new Set(
    [
      ...record.definition.proficiencies.skills.filter(
        (skill) => skill.level === "proficient" || skill.level === "expertise",
      ),
      ...granted,
    ].map(({ ref }) => ref.name),
  );
  const named = (names: readonly string[]) =>
    names.map((name) => option({ field, name: name.toLowerCase() }, name));
  switch (field) {
    case "skills":
      return named(skills);
    case "expertise":
      return named(skills.filter((name) => proficient.has(name)));
    case "tools":
      return named(
        hits.tools
          .filter((hit) => !offer.types || (hit.item?.tool && offer.types.includes(hit.item.tool)))
          .map((hit) => hit.name),
      );
    case "languages":
      return named(hits.languages.map((hit) => hit.name));
    case "savingThrows":
      return ABILITIES.map((ability) => option({ field, name: ability }, ABILITY_LABEL[ability]));
    case "resist":
      return [];
  }
}

/** The options an offer's slot gives, its named ones first, each field's pool after. */
function offerOptions(offer: FeatOffer, pools: (field: FeatPick["field"]) => Option[]): Option[] {
  const listed = offer.fields.flatMap((field) => {
    // Expertise needs the proficiency, so a listed skill the character lacks is not offered.
    const proficient =
      field === "expertise" ? new Set(pools(field).map(({ value }) => value)) : undefined;
    return (offer.from ?? [])
      .filter((name) => !proficient || proficient.has(pickValue({ field, name })))
      .map((name) =>
        option(
          { field, name },
          field === "savingThrows" ? ABILITY_LABEL[name as Ability] : titleCase(name),
        ),
      );
  });
  const any = offer.from === null || offer.types ? offer.fields.flatMap(pools) : [];
  const seen = new Set<string>();
  return [...listed, ...any].filter(({ value }) => !seen.has(value) && seen.add(value));
}

/**
 * The picks a feat's own fields offer — a saving throw, a skill, a tool, a language, a
 * resistance — and, for a feat taken outside an improvement, the increases it offers, each
 * saved as soon as it is picked. A name another slot of the same field holds is not offered
 * again, and a pick stays shown while the list it came from loads or after it leaves it.
 *
 * Each offer is asked on its own, so `Resilient` (XPHB) can store a Constitution save beside
 * a +1 to Strength, where the rules raise the save's ability. Upstream writes no field tying
 * the two; a feat table naming the feats that tie them is the way out.
 */
export function FeatPicks({ character, index }: { character: CharacterRecord; index: number }) {
  const { definition } = character;
  const entry = definition.feats[index];
  const { rows: feats } = useFeatRows(definition.edition);
  const derived = useCharacterDerived(character.id).data;
  const row = entry && featRow(feats, entry.ref);
  const offers = row ? featGrantsSchema.parse(row.json).offers : [];
  const wants = (field: FeatPick["field"]) =>
    offers.some((offer) => offer.fields.includes(field) && (offer.from === null || offer.types));
  const search = { edition: definition.edition, query: "", limit: 200 };
  const tools = useCatalogSearch({
    ...search,
    type: "item",
    listAll: wants("tools"),
    filters: { kind: "tool", rarity: "none" },
  });
  const languages = useCatalogSearch({ ...search, type: "language", listAll: wants("languages") });
  const write = useHeldSave(character.id, `${row?.name ?? "Feat"} choice`);
  if (!entry || !row) return null;

  const own = entry.picks?.ability ?? [];
  // Items stay out of the cap, as an improvement's does: a belt setting Strength to 21
  // leaves the score's own room under 20 where it was.
  const totals = Object.fromEntries(
    ABILITIES.map((ability) => [
      ability,
      abilityScore(definition, ability) -
        own.filter((raise) => raise.ability === ability).reduce((sum, r) => sum + r.amount, 0),
    ]),
  ) as Record<Ability, number>;
  const alternatives =
    entry.level === undefined
      ? alternativesOf({ feat: entry.ref, increases: [] }, feats, totals)
      : [];
  const placing = alternatives.length > 1 || alternatives.some((each) => each.slots.length > 0);
  const slots = pickSlots(offers, entry.picks);
  const hits = { tools: tools.data?.items ?? [], languages: languages.data?.items ?? [] };

  const save = (key: string, change: (picks: Picks) => Picks) =>
    write(key, (latest) => ({
      ...latest,
      feats: latest.feats.map((feat, at) => {
        // The row's position comes from the features query, which lags an add or a removal,
        // so a write lands only on the feat the row was drawn for.
        if (at !== index || entryKey(feat.ref) !== entryKey(entry.ref)) return feat;
        const { picks: _, ...rest } = feat;
        const picks = change(feat.picks);
        return picks && Object.keys(picks).length > 0 ? { ...rest, picks } : rest;
      }),
    }));

  if (offers.length === 0 && !placing) return null;
  return (
    <div className="flex flex-wrap items-end gap-2">
      {offers.map((offer, at) => {
        const options = offerOptions(offer, (field) =>
          pool(field, offer, derived, character, hits),
        );
        return slots[at]?.map((held, slot) => {
          const value = held ? pickValue(held) : UNCHOSEN;
          const elsewhere = new Set(
            slots
              .flat()
              .filter((pick) => pick && pick !== held)
              .map((pick) => pickValue(pick as FeatPick)),
          );
          const field = offer.fields.map((each) => FIELD_LABEL[each]).join(" or ");
          const count = offer.count;
          return (
            <FormField
              // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its position.
              key={`${at}-${slot}`}
              label={`${row.name} ${field}${count > 1 ? `, ${slot + 1} of ${count}` : ""}`}
              labelHidden
            >
              {(control) => (
                <Select
                  {...control}
                  options={[
                    ...(held && !options.some((each) => each.value === value)
                      ? [option(held, titleCase(held.name))]
                      : []),
                    ...options.filter((each) => each.value === value || !elsewhere.has(each.value)),
                  ]}
                  value={value}
                  onChange={(next) =>
                    save(`feat|${index}|${at}|${slot}`, (picks) =>
                      withPick(offers, picks, at, slot, next),
                    )
                  }
                />
              )}
            </FormField>
          );
        });
      })}
      {placing && (
        <IncreaseFields
          name={row.name}
          alternatives={alternatives}
          increases={own}
          onChange={(raises: Raise[]) =>
            save(`feat|${index}|ability`, (picks) => {
              const { ability: _, ...rest } = picks ?? {};
              return raises.length > 0 ? { ...rest, ability: raises } : rest;
            })
          }
        />
      )}
    </div>
  );
}
