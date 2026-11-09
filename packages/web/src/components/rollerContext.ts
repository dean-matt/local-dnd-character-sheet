import type { rollLogEntrySchema } from "@dnd/character";
import { createContext } from "react";
import type { z } from "zod";

/**
 * The id of the character whose sheet is open. Set by the character layout alone, so a
 * roll in the catalog or a homebrew preview has no log to record to and renders as text.
 */
export const RollingFor = createContext<string | null>(null);

/** Called with each roll once it is recorded; the character layout opens the roll log on it. */
export const OnRolled = createContext<(roll: z.infer<typeof rollLogEntrySchema>) => void>(() => {});
