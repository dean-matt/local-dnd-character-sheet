/** The query keys every character hook shares, so an invalidation by prefix reaches them all. */
export const charactersKey = ["characters"] as const;
export const characterKey = (id: string) => [...charactersKey, id] as const;
export const characterPagesKey = (id: string) => [...characterKey(id), "pages"] as const;
/** Tags a definition write, so undo can wait for one in flight rather than race it. */
export const characterDefinitionWriteKey = (id: string) =>
  [...characterKey(id), "definition-write"] as const;
export const characterUndoKey = (id: string) => [...characterKey(id), "undo"] as const;
