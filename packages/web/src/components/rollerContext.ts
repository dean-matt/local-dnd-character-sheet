import { createContext } from "react";

/**
 * The id of the character whose sheet is open. Set by the character layout alone, so a
 * roll in the catalog or a homebrew preview has no log to record to and renders as text.
 */
export const RollingFor = createContext<string | null>(null);
