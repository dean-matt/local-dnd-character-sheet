/** The query keys every character hook shares, so an invalidation by prefix reaches them all. */
export const charactersKey = ["characters"] as const;
export const characterKey = (id: string) => [...charactersKey, id] as const;
export const characterDerivedKey = (id: string) => [...characterKey(id), "derived"] as const;
export const characterInventoryKey = (id: string) => [...characterKey(id), "inventory"] as const;
export const characterSpellsKey = (id: string) => [...characterKey(id), "spells"] as const;
export const characterStateKey = (id: string) => [...characterKey(id), "state"] as const;
/** Tags every write to a character's state, so a control can see one another control started. */
export const characterStateWriteKey = (id: string) => [...characterKey(id), "state-write"] as const;
export const characterPagesKey = (id: string) => [...characterKey(id), "pages"] as const;
/** Tags every write to a character's definition, an undo among them, so a control can see one in flight. */
export const characterDefinitionWriteKey = (id: string) =>
  [...characterKey(id), "definition-write"] as const;
/** Tags an undo, which a state control waits on, since an undo can restore the state. */
export const characterUndoWriteKey = (id: string) =>
  [...characterDefinitionWriteKey(id), "undo"] as const;
/** Writes to one character's definition and state run one at a time, an undo among them. */
export const characterWriteScope = (id: string) => `write:${id}`;
export const characterUndoKey = (id: string) => [...characterKey(id), "undo"] as const;
/** Every character's rolls, under `charactersKey` so a deleted character leaves the panel. */
export const rollsKey = [...charactersKey, "rolls"] as const;
