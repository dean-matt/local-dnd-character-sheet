import { createContext } from "react";

/** True inside a `Modal`, whose scrolling body clips anything drawn in normal flow. */
export const InModal = createContext(false);
