import type { CharacterDerived, CharacterRecord, PageBlock } from "@dnd/character";

/**
 * What every block view takes. `character` and `derived` reach every kind alike, even
 * the ones that ignore them, so a new kind that needs either costs nothing to wire up.
 */
export interface BlockViewProps {
  block: PageBlock;
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}
