/** A list the player picks from: how many picks, and of what. */
export type Offer<T> = { count: number; options: readonly T[] };

export type Tally<T> = {
  /** What each offer's picks spend, in the order of the offers. */
  picked: T[][];
  /** Things held that no offer lists and nothing grants. */
  outside: T[];
};

/** Names each thing picked, so two offers listing it agree on it. */
type Key<T> = (item: T) => string;

const lists = <T>(offer: Offer<T>, item: T, key: Key<T>) =>
  offer.options.some((option) => key(option) === key(item));

/**
 * The offer each of `items` fills, or -1, filling as many of the offers' picks as any
 * assignment can. A thing two lists hold goes to the first with room, and moves to the
 * other where that frees room for a thing only the first holds, so the order the player
 * clicked in never strands a pick. Kuhn's augmenting paths, with each offer's count as its
 * capacity.
 */
function assign<T>(offers: readonly Offer<T>[], items: readonly T[], key: Key<T>): number[] {
  const owner = items.map(() => -1);
  const holders = items.map((item) =>
    offers.flatMap((offer, index) => (lists(offer, item, key) ? [index] : [])),
  );
  const takers = (index: number) => owner.flatMap((each, other) => (each === index ? [other] : []));
  const roomy = (index: number) => takers(index).length < (offers[index]?.count ?? 0);
  const place = (item: number, seen: Set<number>): boolean => {
    const mine = holders[item] ?? [];
    const free = mine.find(roomy);
    if (free !== undefined) {
      owner[item] = free;
      return true;
    }
    return mine.some((index) => {
      if (seen.has(index)) return false;
      seen.add(index);
      if (!takers(index).some((other) => place(other, seen))) return false;
      owner[item] = index;
      return true;
    });
  };
  for (const item of items.keys()) place(item, new Set());
  return owner;
}

/**
 * Which offer each held thing spends. A thing no offer has room for overspends the first
 * that lists it. A thing whose key `granted` holds spends nothing.
 */
export function tally<T>(
  offers: readonly Offer<T>[],
  granted: ReadonlySet<string>,
  held: readonly T[],
  key: Key<T>,
): Tally<T> {
  const items = held.filter((item) => !granted.has(key(item)));
  const owner = assign(offers, items, key);
  const picked: T[][] = offers.map(() => []);
  const outside: T[] = [];
  items.forEach((item, index) => {
    const matched = owner[index] ?? -1;
    const spends = matched !== -1 ? matched : offers.findIndex((offer) => lists(offer, item, key));
    if (spends === -1) outside.push(item);
    else picked[spends]?.push(item);
  });
  return { picked, outside };
}

/** How many of the offers' picks the things nothing grants can fill at most. */
function fillable<T>(
  offers: readonly Offer<T>[],
  granted: ReadonlySet<string>,
  key: Key<T>,
): number {
  const open = [
    ...new Map(
      offers
        .flatMap((offer) => offer.options.filter((option) => !granted.has(key(option))))
        .map((item) => [key(item), item]),
    ).values(),
  ];
  return assign(offers, open, key).filter((index) => index !== -1).length;
}

/** How many of `offer`'s picks can be spent, which a list the grants already cover cuts short. */
export function needed<T>(offer: Offer<T>, granted: ReadonlySet<string>, key: Key<T>): number {
  return Math.min(offer.count, offer.options.filter((option) => !granted.has(key(option))).length);
}

/** Whether the held things fill as many picks as the things nothing grants can. */
export function spent<T>(
  offers: readonly Offer<T>[],
  granted: ReadonlySet<string>,
  { picked }: Tally<T>,
  key: Key<T>,
): boolean {
  const filled = offers.reduce(
    (sum, offer, index) => sum + Math.min(picked[index]?.length ?? 0, offer.count),
    0,
  );
  return filled >= fillable(offers, granted, key);
}

/**
 * The 2014 rule's replacement: a character who would gain the same proficiency from two
 * sources picks any other of its kind instead. That is each thing two grants give, and each
 * pick the offers cannot fill once the grants are counted. `count` is how many picks, `name`
 * what they replace, and `noun` the kind `name` speaks of. `undefined` where nothing is
 * gained twice.
 */
export function duplicates<T>(
  offers: readonly (Offer<T> & { name: string })[],
  granted: readonly { item: T; by: string }[],
  key: Key<T>,
  label: (item: T) => string,
  noun: string,
): { count: number; name: string } | undefined {
  const bys = new Map<string, { item: T; by: string[] }>();
  for (const grant of granted) {
    const each = bys.get(key(grant.item)) ?? { item: grant.item, by: [] };
    each.by.push(grant.by);
    bys.set(key(grant.item), each);
  }
  const twice = [...bys.values()].filter((each) => each.by.length > 1);
  const unfilled =
    offers.reduce((sum, offer) => sum + offer.count, 0) -
    fillable(offers, new Set(bys.keys()), key);
  const count = twice.reduce((sum, each) => sum + each.by.length - 1, 0) + unfilled;
  if (count === 0) return undefined;
  const reasons = [
    ...twice.map((each) => `${label(each.item)}, granted by both ${each.by.join(" and ")}`),
    ...(unfilled > 0
      ? [
          `${unfilled === 1 ? "a pick" : `${unfilled} picks`} the ${new Intl.ListFormat("en").format(offers.map((offer) => offer.name))} ${offers.length === 1 ? "list has" : "lists have"} no ${noun} left for`,
        ]
      : []),
  ];
  return { count, name: reasons.join("; ") };
}
