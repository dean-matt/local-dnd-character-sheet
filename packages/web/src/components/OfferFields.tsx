import type { FeatOffer, SearchHit } from "@dnd/catalog";
import {
  ABILITIES,
  ABILITY_LABEL,
  type Ability,
  type CharacterDefinition,
  type CharacterDerived,
  derivedValue,
  type FeatPick,
} from "@dnd/character";
import { useCatalogSearch } from "../hooks/useCatalogSearch.ts";
import { pickSlots, pickValue, withPick } from "../lib/featPicks.ts";
import { titleCase } from "../lib/proficiencyGrants.ts";
import { FormField } from "./FormField.tsx";
import { Select } from "./Select.tsx";

const UNCHOSEN = "Choose one";

type Picks = CharacterDefinition["feats"][number]["picks"];

type Option = { value: string; label: string };

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
  proficiencies: CharacterDefinition["proficiencies"],
  hits: { tools: readonly SearchHit[]; languages: readonly SearchHit[] },
): Option[] {
  const skills = derived?.skills.map(({ ref }) => ref.name) ?? [];
  const granted = derived
    ? [...derivedValue(derived.featGrants).skills, ...derivedValue(derived.itemGrants).skills]
    : [];
  const proficient = new Set(
    [
      ...proficiencies.skills.filter(
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

export interface OfferFieldsProps {
  /** What the picks are for, such as a feat's or a feature's name, in each control's label. */
  name: string;
  edition: CharacterDefinition["edition"];
  proficiencies: CharacterDefinition["proficiencies"];
  derived: CharacterDerived | undefined;
  offers: readonly FeatOffer[];
  picks: Picks;
  /** Called with a key naming the slot, for a save that tells slots apart, and the change to `picks`. */
  onChange: (slot: string, change: (picks: Picks) => Picks) => void;
}

/**
 * One control for each slot of each offer, filled from `picks`. A name another slot of the same
 * field holds is not offered again, and a pick stays shown while the list it came from loads or
 * after it leaves it.
 */
export function OfferFields({
  name,
  edition,
  proficiencies,
  derived,
  offers,
  picks,
  onChange,
}: OfferFieldsProps) {
  const wants = (field: FeatPick["field"]) =>
    offers.some((offer) => offer.fields.includes(field) && (offer.from === null || offer.types));
  const search = { edition, query: "", limit: 200 };
  const tools = useCatalogSearch({
    ...search,
    type: "item",
    listAll: wants("tools"),
    filters: { kind: "tool", rarity: "none" },
  });
  const languages = useCatalogSearch({ ...search, type: "language", listAll: wants("languages") });
  const hits = { tools: tools.data?.items ?? [], languages: languages.data?.items ?? [] };
  const slots = pickSlots(offers, picks);
  return offers.map((offer, at) => {
    const options = offerOptions(offer, (field) =>
      pool(field, offer, derived, proficiencies, hits),
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
          label={`${name} ${field}${count > 1 ? `, ${slot + 1} of ${count}` : ""}`}
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
                onChange(`${at}|${slot}`, (latest) => withPick(offers, latest, at, slot, next))
              }
            />
          )}
        </FormField>
      );
    });
  });
}
