import type { ResolvedRef } from "@dnd/catalog";
import { createContext } from "react";

/** `null` outside a block. Inside one, the rows its references have resolved to so far. */
export const ResolvedRefs = createContext<ReadonlyMap<string, ResolvedRef> | null>(null);
