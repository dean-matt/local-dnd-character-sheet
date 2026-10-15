import { casterProgressionSchema, featRecordSchema, itemRecordSchema } from "@dnd/catalog";
import {
  type CharacterDefinition,
  type ContentRef,
  classLevels,
  entryKey,
  totalLevel,
} from "@dnd/character";
import { type QueryClient, queryOptions, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import type { Addable } from "../lib/addable.ts";
import { withFeat, withItem, withSpell } from "../lib/addedEntries.ts";
import { apiGet } from "../lib/api.ts";
import { castableCeiling } from "../lib/casterFacts.ts";
import { withDeparture } from "../lib/departures.ts";
import { candidateAt, featBarrier } from "../lib/improvementFeats.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { classGrantsQuery } from "./classGrantsQuery.ts";
import { classQuery } from "./classQuery.ts";
import { classSpellListQuery } from "./classSpellListQuery.ts";
import { subclassGrantsQuery } from "./subclassGrantsQuery.ts";
import { characterQuery } from "./useCharacter.ts";
import { useUpdateCharacterDefinition } from "./useUpdateCharacterDefinition.ts";

/** What an add tells the user: what happened, and why the rules would not have it. */
export interface AddOutcome {
  text: string;
  note?: string;
  failed?: true;
}

type Edit = (definition: CharacterDefinition) => CharacterDefinition;

/** The edit an add makes, or why it makes none, and what departs from the rules. */
type Plan = { edit: Edit; note?: string } | { skip: string };

const or = new Intl.ListFormat("en", { type: "disjunction" });

const rowQuery = <T>(collection: string, ref: ContentRef, schema: z.ZodType<T>) =>
  queryOptions({
    queryKey: [collection, ref.name, ref.source],
    queryFn: () =>
      apiGet(
        `/${collection}/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.source)}`,
        schema,
      ),
    retry: retryUnlessClientError,
  });

/** Each catalog class the character has levels in, with its level and any subclass. */
const catalogClasses = (definition: CharacterDefinition) =>
  classLevels(definition).flatMap(({ class: cls, level, subclass }) =>
    "name" in cls ? [{ class: cls, level, ...(subclass && { subclass }) }] : [],
  );

/** Whether `key` is above the highest level `list`'s class casts, as the sheet's picker reads it. */
async function aboveCeiling(
  client: QueryClient,
  edition: CharacterDefinition["edition"],
  list: ReturnType<typeof catalogClasses>[number],
  key: string,
): Promise<boolean> {
  const { class: cls, level, subclass } = list;
  const [own, sub, row] = await Promise.all([
    client.fetchQuery(classGrantsQuery(cls, level)),
    subclass ? client.fetchQuery(subclassGrantsQuery(cls, subclass, level)) : undefined,
    client.fetchQuery(classQuery(cls)),
  ]);
  const pact = casterProgressionSchema.parse(row.json) === "pact";
  const ceiling = castableCeiling(sub ? [own, sub] : [own], pact, level);
  if (ceiling >= 9) return false;
  return (await client.fetchQuery(classSpellListQuery(edition, list, ceiling + 1))).has(key);
}

/**
 * A spell learns for the first class whose list holds it, as the sheet's picker learns it
 * for the class chosen there. One no class lists lands with no class, and one above the
 * level that class's slots cast lands for it, each noted. A homebrew spell is on no list and
 * stays open to every class, as the picker holds.
 */
async function planSpell(
  client: QueryClient,
  definition: CharacterDefinition,
  row: Addable,
  who: string,
): Promise<Plan> {
  const key = entryKey(row.ref);
  if (definition.spells.some((spell) => entryKey(spell.ref) === key)) {
    return { skip: `${who} knows ${row.label} already.` };
  }
  const classes = catalogClasses(definition);
  if ("homebrewId" in row.ref || classes.length === 0) {
    return { edit: (latest) => withSpell(latest, row.ref, undefined) };
  }
  const lists = await Promise.all(
    classes.map((list) => client.fetchQuery(classSpellListQuery(definition.edition, list))),
  );
  const holder = classes[lists.findIndex((list) => list.has(key))];
  const origin = holder?.class;
  const edit: Edit = (latest) => withSpell(latest, row.ref, origin);
  if (!holder) {
    const names = or.format(classes.map((each) => each.class.name));
    return { edit, note: `${row.label} is not on the ${names} spell list.` };
  }
  return (await aboveCeiling(client, definition.edition, holder, key))
    ? { edit, note: `${row.label} is above the highest level a ${holder.class.name} slot casts.` }
    : { edit };
}

/**
 * A feat's prerequisites read against the character as it stands, with every class and
 * subclass feature it holds. `candidateAt` reads a level's improvement with that level's
 * own choice set aside, so it reads one level on, where nothing is stored, and the level
 * is put back after.
 */
async function planFeat(
  client: QueryClient,
  definition: CharacterDefinition,
  row: Addable,
  who: string,
): Promise<Plan> {
  const edit: Edit = (latest) => withFeat(latest, row.ref);
  if ("homebrewId" in row.ref) return { edit };
  const ref = row.ref;
  const classes = catalogClasses(definition);
  const [feat, ...grants] = await Promise.all([
    client.fetchQuery(rowQuery("feats", ref, featRecordSchema)),
    ...classes.flatMap(({ class: cls, level, subclass }) => [
      client.fetchQuery(classGrantsQuery(cls, level)),
      ...(subclass ? [client.fetchQuery(subclassGrantsQuery(cls, subclass, level))] : []),
    ]),
  ]);
  const features = grants.flatMap((grant) =>
    grant.features.filter(({ level }) => level <= grant.level).map(({ name }) => name),
  );
  const level = totalLevel(definition);
  const candidate = { ...candidateAt(definition, { level: level + 1, features }), level };
  const notes = {
    noFeats: `${who} takes a feat only under the Feats house rule.`,
    held: `${who} holds ${row.label} already, and it does not repeat.`,
    prerequisite: `${who} does not meet a prerequisite of ${row.label}.`,
  };
  const barrier = featBarrier(feat, candidate);
  return { edit, ...(barrier && { note: notes[barrier] }) };
}

/** A magic variant named alone lands as its generic row, noted, since it needs a base item. */
async function planItem(client: QueryClient, row: Addable): Promise<Plan> {
  const entry = { ref: row.ref, ...(row.variant && { variant: row.variant }) };
  const edit: Edit = (latest) => withItem(latest, entry);
  if ("homebrewId" in row.ref || row.variant) return { edit };
  const item = await client.fetchQuery(rowQuery("items", row.ref, itemRecordSchema));
  return item.kind === "magicvariant"
    ? { edit, note: `${row.label} is a magic variant, held only beside a base item.` }
    : { edit };
}

const FIELDS = { item: "inventory", spell: "spells", feat: "feats" } as const;

/**
 * Adds a catalog or homebrew row to the character `id` through the same edits the sheet's
 * own pickers make, and says how it went. A row the rules would refuse lands anyway, with a
 * departure noting why, as creation notes one; a spell known already is not learned twice.
 *
 * The departure is keyed by the row, so adding it again replaces its note, but removing
 * the row from the sheet leaves the note behind. Dropping a departure with the entry it
 * names is the way out.
 */
export function useAddToCharacter(id: string) {
  const client = useQueryClient();
  const update = useUpdateCharacterDefinition(id);
  return async (row: Addable): Promise<AddOutcome> => {
    let who = "the character";
    try {
      const { name, definition } = await client.fetchQuery(characterQuery(id));
      who = name;
      const plan =
        row.kind === "spell"
          ? await planSpell(client, definition, row, name)
          : row.kind === "feat"
            ? await planFeat(client, definition, row, name)
            : await planItem(client, row);
      if ("skip" in plan) return { text: plan.skip };
      const field = `${FIELDS[row.kind]}.${entryKey(row.ref)}`;
      await update.mutateAsync((latest) => {
        const next = plan.edit(latest);
        return { ...next, departures: withDeparture(next.departures, field, plan.note) };
      });
      return {
        text: `Added ${row.label} to ${name}.`,
        ...(plan.note && { note: `Noted: ${plan.note}` }),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { text: `Couldn't add ${row.label} to ${who}: ${reason}`, failed: true };
    }
  };
}
