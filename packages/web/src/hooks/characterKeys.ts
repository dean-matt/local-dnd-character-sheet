/** The query keys every character hook shares, so an invalidation by prefix reaches them all. */
export const charactersKey = ["characters"] as const;
export const characterKey = (id: string) => [...charactersKey, id] as const;
export const characterPagesKey = (id: string) => [...characterKey(id), "pages"] as const;
