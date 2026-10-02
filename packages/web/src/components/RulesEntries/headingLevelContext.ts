import { createContext } from "react";

/**
 * The level a named subsection's heading takes, one deeper for each section around it.
 * 4 sits under the `h3` a sheet section opens with.
 */
export const HeadingLevel = createContext(4);
