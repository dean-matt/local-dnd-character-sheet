/** The query keys every character hook shares, so an invalidation by prefix reaches them all. */
export const charactersKey = ["characters"] as const;
export const characterKey = (id: string) => [...charactersKey, id] as const;
export const characterPagesKey = (id: string) => [...characterKey(id), "pages"] as const;
/**
 * Tags every write to a character's definition, an undo among them, so a control that
 * writes it waits out one in flight: a write built before the other lands over it.
 */
export const characterDefinitionWriteKey = (id: string) =>
  [...characterKey(id), "definition-write"] as const;
export const characterUndoKey = (id: string) => [...characterKey(id), "undo"] as const;
