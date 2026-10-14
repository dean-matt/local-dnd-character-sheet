type Ref = { name: string; source: string };

const nameSource = (ref: Ref) => `${ref.name}|${ref.source}`;

/**
 * The `/search` filters narrowing a spell picker to a class's list, with the subclass's
 * additions at the class level `level`. None where `list` is `undefined` or the picker
 * offers spells `offList`.
 */
export const spellListFilters = (
  list: { class: Ref; subclass?: Ref; level: number } | undefined,
  offList = false,
) =>
  list && !offList
    ? {
        class: nameSource(list.class),
        ...(list.subclass && { subclass: nameSource(list.subclass) }),
        classLevel: String(list.level),
      }
    : {};
