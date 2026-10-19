/**
 * A row's name as the web shows it. Upstream ends a template or grouped entry's name in
 * ` (*)`, as `Arrow of Slaying (*)`; the star stays in the name the row is keyed and
 * looked up by, and is left off wherever a reader sees it.
 */
export const displayName = (name: string) => name.replace(/ \(\*\)$/, "");
